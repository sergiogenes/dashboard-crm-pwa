'use server'

import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import Company from '@/models/Company'
import Lead from '@/models/Lead'
import User from '@/models/User'
import { LocalLead, LocalCompany } from '@/lib/db'

async function getUserIdOrThrow(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function pushClientChanges(
  leads: Omit<LocalLead, 'synced'>[],
  companies: Omit<LocalCompany, 'synced'>[],
) {
  const userId = await getUserIdOrThrow()
  await dbConnect()

  console.log(`[pushClientChanges] Recibidas ${companies.length} empresas:`, JSON.stringify(companies))
  console.log(`[pushClientChanges] Recibidos ${leads.length} leads:`, JSON.stringify(leads))

  const companyMappings: { tempId: string; id: string }[] = []
  const leadMappings: { tempId: string; id: string }[] = []

  // 1. Procesar empresas y registrar mapeo de IDs temporales a reales
  const tempToRealCompanyId = new Map<string, string>()

  for (const clientComp of companies) {
    if (clientComp.id) {
      if (clientComp.deleted) {
        await Company.findOneAndUpdate(
          { _id: clientComp.id },
          { deleted: true, crmSynced: false },
        )
      } else {
        await Company.findOneAndUpdate(
          { _id: clientComp.id },
          {
            name: clientComp.name,
            domain: clientComp.domain,
            crmSynced: false,
          },
        )
      }
      if (clientComp.tempId) {
        tempToRealCompanyId.set(clientComp.tempId, clientComp.id)
      }
    } else if (clientComp.tempId) {
      // Evitar duplicados por nombre en MongoDB a nivel global
      let existingComp = await Company.findOne({
        name: clientComp.name,
        deleted: false,
      })

      if (!existingComp) {
        existingComp = new Company({
          name: clientComp.name,
          domain: clientComp.domain,
          userId,
          crmSynced: false,
          deleted: clientComp.deleted || false,
        })
        await existingComp.save()
      } else if (clientComp.deleted) {
        existingComp.deleted = true
        existingComp.crmSynced = false
        await existingComp.save()
      }

      const realId = existingComp._id.toString()
      tempToRealCompanyId.set(clientComp.tempId, realId)
      companyMappings.push({ tempId: clientComp.tempId, id: realId })
    }
  }

  // 2. Procesar leads resolviendo las relaciones con empresas
  for (const clientLead of leads) {
    let resolvedCompanyId: string | null = null

    if (clientLead.companyId) {
      if (tempToRealCompanyId.has(clientLead.companyId)) {
        resolvedCompanyId = tempToRealCompanyId.get(clientLead.companyId)!
      } else {
        resolvedCompanyId = clientLead.companyId
      }
    }

    // Sanitizar companyId: si no es un ObjectId válido (ej. un UUID huérfano), se asigna a null
    if (resolvedCompanyId && !mongoose.Types.ObjectId.isValid(resolvedCompanyId)) {
      console.warn(`[pushClientChanges] Advertencia: companyId "${resolvedCompanyId}" no es un ObjectId válido. Seteando a null.`)
      resolvedCompanyId = null
    }

    if (clientLead.id) {
      if (clientLead.deleted) {
        await Lead.findOneAndUpdate(
          { _id: clientLead.id, userId },
          { deleted: true, crmSynced: false },
        )
      } else {
        await Lead.findOneAndUpdate(
          { _id: clientLead.id, userId },
          {
            firstName: clientLead.firstName,
            lastName: clientLead.lastName,
            email: clientLead.email,
            phone: clientLead.phone,
            companyId: resolvedCompanyId,
            crmSynced: false,
          },
        )
      }
    } else if (clientLead.tempId) {
      // Evitar duplicados por email en MongoDB para el mismo usuario
      let existingLead = await Lead.findOne({
        email: clientLead.email,
        userId,
        deleted: false,
      })

      if (!existingLead) {
        existingLead = new Lead({
          firstName: clientLead.firstName,
          lastName: clientLead.lastName,
          email: clientLead.email,
          phone: clientLead.phone,
          companyId: resolvedCompanyId,
          userId,
          crmSynced: false,
          deleted: clientLead.deleted || false,
        })
        await existingLead.save()
      } else {
        // Si ya existe, actualizamos sus campos
        existingLead.firstName = clientLead.firstName
        existingLead.lastName = clientLead.lastName
        existingLead.phone = clientLead.phone
        existingLead.companyId = resolvedCompanyId
        existingLead.crmSynced = false
        if (clientLead.deleted) {
          existingLead.deleted = true
        }
        await existingLead.save()
      }

      const realId = existingLead._id.toString()
      leadMappings.push({ tempId: clientLead.tempId, id: realId })
    }
  }

  // Disparar sincronización asíncrona de MongoDB al CRM en segundo plano sin esperar (fire-and-forget)
  const { syncMongoDBToCRM } = await import('@/lib/crm/sync-engine')
  syncMongoDBToCRM().catch((err) =>
    console.error('[Sync Trigger] Falló la sincronización saliente:', err),
  )

  return {
    success: true,
    companyMappings,
    leadMappings,
  }
}

export async function pullServerUpdates(lastSyncTime: number) {
  const userId = await getUserIdOrThrow()
  await dbConnect()

  // Comprobar si la base de datos intermedia (MongoDB) está vacía de empresas o leads (contando activos y eliminados)
  const companyCount = await Company.countDocuments()
  const user = await User.findById(userId)
  const leadCount = user?.crmOwnerId
    ? await Lead.countDocuments({ userId })
    : 0

  const needsImport =
    lastSyncTime === 0 ||
    companyCount === 0 ||
    (user?.crmOwnerId && leadCount === 0)

  // Si es la primera sincronización o la base de datos está vacía, importamos activamente desde HubSpot
  if (needsImport) {
    try {
      const { CRMProviderFactory } = await import('@/lib/crm/factory')
      const crm = CRMProviderFactory.getProvider()
      const isCrmOnline = await crm.checkHealth()

      if (isCrmOnline) {
        // A. Autodetectar crmOwnerId por email en HubSpot si no existe todavía
        if (user && !user.crmOwnerId) {
          const ownerId = await crm.fetchOwnerIdByEmail(user.email)
          if (ownerId) {
            user.crmOwnerId = ownerId
            await user.save()
            console.log(
              `[Sync] Mapeado crmOwnerId automáticamente para ${user.email} -> ${ownerId}`,
            )
          }
        }

        // 1. Importar empresas de HubSpot a MongoDB (Para todos los usuarios)
        const crmCompanies = await crm.fetchAllCompanies()
        for (const crmComp of crmCompanies) {
          if (crmComp.crmId) {
            await Company.findOneAndUpdate(
              {
                $or: [
                  { crmId: crmComp.crmId },
                  { name: crmComp.name, deleted: false },
                ],
              },
              {
                $setOnInsert: {
                  name: crmComp.name,
                  domain: crmComp.domain,
                  userId: userId,
                  crmLastSyncAt: new Date(),
                  deleted: false,
                },
                $set: {
                  crmId: crmComp.crmId,
                  crmSynced: true,
                },
              },
              { upsert: true, new: true },
            )
          }
        }

        // 2. Importar contactos (Leads) de HubSpot a MongoDB (Solo si el usuario tiene crmOwnerId)
        if (user?.crmOwnerId) {
          const crmLeads = await crm.fetchLeadsByOwner(user.crmOwnerId)
          for (const crmLead of crmLeads) {
            if (crmLead.crmId) {
              await Lead.findOneAndUpdate(
                {
                  $or: [
                    { crmId: crmLead.crmId },
                    { email: crmLead.email, userId, deleted: false },
                  ],
                },
                {
                  $setOnInsert: {
                    firstName: crmLead.firstName,
                    lastName: crmLead.lastName,
                    email: crmLead.email,
                    phone: crmLead.phone,
                    userId: userId,
                    crmLastSyncAt: new Date(),
                    deleted: false,
                  },
                  $set: {
                    crmId: crmLead.crmId,
                    crmSynced: true,
                  },
                },
                { upsert: true, new: true },
              )
            }
          }
        }
      }
    } catch (err: any) {
      console.error(
        '[Sync Action] Error en importación inicial de HubSpot:',
        err,
      )
      throw new Error(
        `Error en la importación inicial de HubSpot: ${err.message}`,
      )
    }
  }

  const sinceDate = new Date(lastSyncTime)

  // Obtener todas las empresas y leads actualizados desde la fecha dada
  const updatedCompanies = await Company.find({
    updatedAt: { $gt: sinceDate },
  })

  const updatedLeads = await Lead.find({
    userId,
    updatedAt: { $gt: sinceDate },
  })

  // Disparar Sincronización asíncrona de MongoDB al CRM en segundo plano (autosanación)
  const { syncMongoDBToCRM } = await import('@/lib/crm/sync-engine')
  syncMongoDBToCRM().catch((err) =>
    console.error('[Sync Trigger] Falló la sincronización saliente:', err),
  )

  return {
    companies: updatedCompanies.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      domain: c.domain,
      deleted: c.deleted,
      userId: c.userId,
      createdAt: c.createdAt.getTime(),
      updatedAt: c.updatedAt.getTime(),
    })),
    leads: updatedLeads.map((l) => ({
      id: l._id.toString(),
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email,
      phone: l.phone,
      companyId: l.companyId?.toString() || undefined,
      deleted: l.deleted,
      userId: l.userId,
      createdAt: l.createdAt.getTime(),
      updatedAt: l.updatedAt.getTime(),
    })),
  }
}
