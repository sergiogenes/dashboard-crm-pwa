'use server'

import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import Company from '@/models/Company'
import Lead, { ILeadSchema } from '@/models/Lead'
import User from '@/models/User'
import Invoice from '@/models/Invoice'
import { LocalLead, LocalCompany, LocalActivity } from '@/lib/db'
import { ICRMProvider, CRMInvoice, CRMActivity } from '@/lib/crm/interface'
import Activity from '@/models/Activity'

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
  activities: Omit<LocalActivity, 'synced'>[] = [],
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

  const activityMappings: { tempId: string; id: string }[] = []

  // 3. Procesar actividades
  for (const clientAct of activities) {
    let resolvedLeadId: string | null = null

    if (clientAct.leadId) {
      const mapping = leadMappings.find(m => m.tempId === clientAct.leadId)
      if (mapping) {
        resolvedLeadId = mapping.id
      } else {
        resolvedLeadId = clientAct.leadId
      }
    }

    if (resolvedLeadId && !mongoose.Types.ObjectId.isValid(resolvedLeadId)) {
      console.warn(`[pushClientChanges] Advertencia: leadId "${resolvedLeadId}" no es un ObjectId válido. Saltando actividad.`)
      continue
    }

    if (clientAct.id) {
      if (clientAct.deleted) {
        await Activity.findOneAndUpdate(
          { _id: clientAct.id, userId },
          { deleted: true, crmSynced: false },
        )
      } else {
        await Activity.findOneAndUpdate(
          { _id: clientAct.id, userId },
          {
            type: clientAct.type,
            title: clientAct.title,
            body: clientAct.body,
            timestamp: new Date(clientAct.timestamp),
            reminderDate: clientAct.reminderDate ? new Date(clientAct.reminderDate) : undefined,
            crmSynced: false,
          },
        )
      }
    } else if (clientAct.tempId) {
      const newAct = new Activity({
        leadId: resolvedLeadId,
        userId,
        type: clientAct.type,
        title: clientAct.title,
        body: clientAct.body,
        timestamp: new Date(clientAct.timestamp),
        reminderDate: clientAct.reminderDate ? new Date(clientAct.reminderDate) : undefined,
        deleted: clientAct.deleted || false,
        crmSynced: false,
      })
      await newAct.save()
      const realId = newAct._id.toString()
      activityMappings.push({ tempId: clientAct.tempId, id: realId })
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
    activityMappings,
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
              { upsert: true, returnDocument: 'after' },
            )
          }
        }

        // 2. Importar contactos (Leads) de HubSpot a MongoDB (Solo si el usuario tiene crmOwnerId)
        if (user?.crmOwnerId) {
          const crmLeads = await crm.fetchLeadsByOwner(user.crmOwnerId)
          const leadDocsToSync: { doc: ILeadSchema; crmId: string }[] = []

          for (const crmLead of crmLeads) {
            if (crmLead.crmId) {
              const leadDoc = await Lead.findOneAndUpdate(
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
                { upsert: true, returnDocument: 'after' },
              )

              if (leadDoc) {
                leadDocsToSync.push({ doc: leadDoc, crmId: crmLead.crmId })
              }
            }
          }

          // Paralelizar la descarga de facturas durante la importación inicial para máxima velocidad
          if (leadDocsToSync.length > 0) {
            await Promise.all(
              leadDocsToSync.map(({ doc, crmId }) =>
                syncInvoicesForLead(doc, crmId, crm, userId)
              )
            )
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

  // Sincronizar facturas y actividades para todos los leads activos en segundo plano para reflejar cambios externos del CRM
  const activeLeads = await Lead.find({ userId, deleted: false })
  if (activeLeads.length > 0) {
    import('@/lib/crm/factory').then(({ CRMProviderFactory }) => {
      const crm = CRMProviderFactory.getProvider()
      crm.checkHealth().then(async (isOnline) => {
        if (isOnline) {
          await Promise.all([
            ...activeLeads.map(lead => {
              if (lead.crmId) {
                return syncInvoicesForLead(lead, lead.crmId, crm, userId)
              }
              return Promise.resolve()
            }),
            ...activeLeads.map(lead => {
              if (lead.crmId) {
                return syncActivitiesForLead(lead, lead.crmId, crm, userId)
              }
              return Promise.resolve()
            })
          ])
        }
      }).catch(err => console.error('[Sync Action Background] Error al validar salud del CRM:', err))
    }).catch(err => console.error('[Sync Action Background] Error al cargar factory:', err))
  }

  // Obtener facturas y actividades actualizadas desde la última sincronización
  const updatedInvoices = await Invoice.find({
    userId,
    updatedAt: { $gt: sinceDate },
  })

  const updatedActivities = await Activity.find({
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
      scoring: l.scoring,
      createdAt: l.createdAt.getTime(),
      updatedAt: l.updatedAt.getTime(),
    })),
    invoices: updatedInvoices.map((inv) => ({
      id: inv._id.toString(),
      crmId: inv.crmId,
      leadId: inv.leadId.toString(),
      userId: inv.userId,
      amount: inv.amount,
      balanceDue: inv.balanceDue,
      status: inv.status,
      invoiceDate: inv.invoiceDate.getTime(),
      dueDate: inv.dueDate.getTime(),
      paymentDate: inv.paymentDate ? inv.paymentDate.getTime() : undefined,
      createdAt: inv.createdAt.getTime(),
      updatedAt: inv.updatedAt.getTime(),
    })),
    activities: updatedActivities.map((act) => ({
      id: act._id.toString(),
      leadId: act.leadId.toString(),
      userId: act.userId,
      type: act.type,
      title: act.title,
      body: act.body,
      timestamp: act.timestamp.getTime(),
      reminderDate: act.reminderDate ? act.reminderDate.getTime() : undefined,
      deleted: act.deleted,
      createdAt: act.createdAt.getTime(),
      updatedAt: act.updatedAt.getTime(),
    })),
  }
}

/**
 * Función auxiliar para sincronizar facturas y calcular el scoring del lead en MongoDB.
 */
async function syncInvoicesForLead(
  leadDoc: ILeadSchema,
  crmLeadCrmId: string,
  crm: ICRMProvider,
  userId: string,
) {
  try {
    const crmInvoices = await crm.fetchInvoicesByLead(crmLeadCrmId)

    // 1. Limpiar facturas previas de este lead en MongoDB para evitar duplicados
    await Invoice.deleteMany({ leadId: leadDoc._id })

    // 2. Insertar las nuevas facturas asociadas a este lead
    if (crmInvoices.length > 0) {
      const invoiceDocs = crmInvoices.map((inv: CRMInvoice) => ({
        crmId: inv.crmId,
        leadId: leadDoc._id,
        userId,
        amount: inv.amount,
        balanceDue: inv.balanceDue ?? (inv.status === 'PAID' ? 0 : inv.amount),
        status: inv.status,
        invoiceDate: new Date(inv.invoiceDate),
        dueDate: new Date(inv.dueDate),
        paymentDate: inv.paymentDate ? new Date(inv.paymentDate) : undefined,
      }))
      await Invoice.insertMany(invoiceDocs)
    }

    // 3. Calcular scoring de crédito en base a las facturas
    const hasOverdue = crmInvoices.some((inv: CRMInvoice) => inv.status === 'OVERDUE')
    const hasPending = crmInvoices.some((inv: CRMInvoice) => inv.status === 'PENDING')
    let scoring = 'A - Excelente'
    
    if (hasOverdue) {
      scoring = 'D - Deudor'
    } else if (hasPending) {
      scoring = 'B - Bueno'
    }

    // 4. Actualizar el scoring en el lead de MongoDB
    if (leadDoc.scoring !== scoring) {
      await Lead.updateOne(
        { _id: leadDoc._id },
        { $set: { scoring } },
      )
      leadDoc.scoring = scoring
    }
  } catch (error) {
    console.error(
      `[syncInvoicesForLead] Error al sincronizar facturas para lead ${leadDoc._id}:`,
      error,
    )
  }
}

/**
 * Función auxiliar para sincronizar actividades del lead desde HubSpot a MongoDB.
 */
async function syncActivitiesForLead(
  leadDoc: ILeadSchema,
  crmLeadCrmId: string,
  crm: ICRMProvider,
  userId: string,
) {
  try {
    const crmActivities = await crm.fetchActivitiesByLead(crmLeadCrmId)

    if (crmActivities.length > 0) {
      const activeCrmIds = crmActivities.map((act) => act.crmId).filter(Boolean) as string[]

      // 1. Marcar como eliminadas en MongoDB las actividades de este lead que ya no existen en el CRM (y que ya se habían sincronizado)
      await Activity.updateMany(
        {
          leadId: leadDoc._id,
          crmSynced: true,
          crmId: { $nin: activeCrmIds },
        },
        { $set: { deleted: true } },
      )

      // 2. Realizar upsert de las actividades recuperadas del CRM
      for (const act of crmActivities) {
        if (act.crmId) {
          // Si la actividad fue eliminada y la eliminación está pendiente de sincronizarse, evitar resucitarla
          const isPendingDelete = await Activity.exists({ crmId: act.crmId, deleted: true, crmSynced: false })
          if (isPendingDelete) {
            continue
          }

          await Activity.findOneAndUpdate(
            { crmId: act.crmId },
            {
              $setOnInsert: {
                leadId: leadDoc._id,
                userId,
                createdAt: new Date(),
              },
              $set: {
                type: act.type,
                title: act.title,
                body: act.body,
                timestamp: new Date(act.timestamp),
                reminderDate: act.reminderDate
                  ? (isNaN(Number(act.reminderDate))
                      ? new Date(act.reminderDate)
                      : new Date(Number(act.reminderDate)))
                  : undefined,
                crmSynced: true,
                deleted: false,
              },
            },
            { upsert: true, returnDocument: 'after' },
          )
        }
      }
    } else {
      // Si el CRM no tiene actividades, marcar como eliminadas todas las actividades sincronizadas de este lead
      await Activity.updateMany(
        { leadId: leadDoc._id, crmSynced: true },
        { $set: { deleted: true } },
      )
    }
  } catch (error) {
    console.error(
      `[syncActivitiesForLead] Error al sincronizar actividades para lead ${leadDoc._id}:`,
      error,
    )
  }
}
