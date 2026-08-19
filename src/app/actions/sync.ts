'use server'

import mongoose from 'mongoose'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import Company from '@/models/Company'
import Lead, { ILeadSchema } from '@/models/Lead'
import User from '@/models/User'
import Invoice from '@/models/Invoice'
import { LocalLead, LocalCompany, LocalActivity, LocalDeal } from '@/lib/db'
import { hash } from '@/lib/crypto'
import {
  ICRMProvider,
  CRMInvoice,
  CRMActivity,
  CRMDeal,
} from '@/lib/crm/interface'
import Activity from '@/models/Activity'
import Deal from '@/models/Deal'

async function getUserIdOrThrow(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

/**
 * IP de origen del request actual, para trazabilidad de operaciones destructivas
 * (soft-deletes que el motor de sync puede propagar como borrado real al CRM).
 * Detrás de ngrok/un proxy, la IP real del cliente viaja en x-forwarded-for
 * (la primera de la lista); si no está, caemos a x-real-ip.
 */
function getSourceIp(): string {
  try {
    const h = headers()
    const forwardedFor = h.get('x-forwarded-for')
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim()
    }
    return h.get('x-real-ip') || 'desconocida'
  } catch {
    return 'desconocida'
  }
}

export async function pushClientChanges(
  leads: Omit<LocalLead, 'synced'>[],
  companies: Omit<LocalCompany, 'synced'>[],
  activities: Omit<LocalActivity, 'synced'>[] = [],
  deals: Omit<LocalDeal, 'synced'>[] = [],
) {
  const userId = await getUserIdOrThrow()
  await dbConnect()
  const sourceIp = getSourceIp()

  console.log(
    `[pushClientChanges] Recibidas ${companies.length} empresas:`,
    JSON.stringify(companies),
  )
  console.log(
    `[pushClientChanges] Recibidos ${leads.length} leads:`,
    JSON.stringify(leads),
  )

  // Traza de auditoría: cualquier soft-delete que llegue en este push puede
  // terminar en un borrado REAL en el CRM externo (ver sync-engine.ts), así
  // que dejamos registro de quién (userId) y desde dónde (IP) lo disparó.
  const deletedLeadIds = leads.filter((l) => l.deleted).map((l) => l.id || l.tempId)
  const deletedCompanyIds = companies
    .filter((c) => c.deleted)
    .map((c) => c.id || c.tempId)
  const deletedDealIds = deals.filter((d) => d.deleted).map((d) => d.id || d.tempId)
  const deletedActivityIds = activities
    .filter((a) => a.deleted)
    .map((a) => a.id || a.tempId)
  if (
    deletedLeadIds.length ||
    deletedCompanyIds.length ||
    deletedDealIds.length ||
    deletedActivityIds.length
  ) {
    console.warn(
      `[pushClientChanges][AUDIT] userId=${userId} ip=${sourceIp} solicita borrado de: ` +
        `leads=[${deletedLeadIds.join(',')}] companies=[${deletedCompanyIds.join(',')}] ` +
        `deals=[${deletedDealIds.join(',')}] activities=[${deletedActivityIds.join(',')}]`,
    )
  }

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
    if (
      resolvedCompanyId &&
      !mongoose.Types.ObjectId.isValid(resolvedCompanyId)
    ) {
      console.warn(
        `[pushClientChanges] Advertencia: companyId "${resolvedCompanyId}" no es un ObjectId válido. Seteando a null.`,
      )
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
            documentId: clientLead.documentId,
            companyId: resolvedCompanyId,
            crmSynced: false,
          },
        )
      }
    } else if (clientLead.tempId) {
      // Evitar duplicados por email en MongoDB para el mismo usuario
      let existingLead = await Lead.findOne({
        emailHash: hash(clientLead.email),
        userId,
        deleted: false,
      })

      if (!existingLead) {
        existingLead = new Lead({
          firstName: clientLead.firstName,
          lastName: clientLead.lastName,
          email: clientLead.email,
          phone: clientLead.phone,
          documentId: clientLead.documentId,
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
        existingLead.documentId = clientLead.documentId
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
      const mapping = leadMappings.find((m) => m.tempId === clientAct.leadId)
      if (mapping) {
        resolvedLeadId = mapping.id
      } else {
        resolvedLeadId = clientAct.leadId
      }
    }

    if (resolvedLeadId && !mongoose.Types.ObjectId.isValid(resolvedLeadId)) {
      console.warn(
        `[pushClientChanges] Advertencia: leadId "${resolvedLeadId}" no es un ObjectId válido. Saltando actividad.`,
      )
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
            reminderDate: clientAct.reminderDate
              ? new Date(clientAct.reminderDate)
              : null,
            reminderRead: clientAct.reminderRead || false,
            reminderStatus: clientAct.reminderStatus || 'active',
            reminderPriority: clientAct.reminderPriority || 'MEDIUM',
            crmSynced: false,
          },
        )
      }
    } else if (clientAct.tempId) {
      // Evitar duplicación si falló el ACK de la sincronización previa
      let existingAct = await Activity.findOne({ tempId: clientAct.tempId })

      if (!existingAct) {
        existingAct = new Activity({
          tempId: clientAct.tempId,
          leadId: resolvedLeadId,
          userId,
          type: clientAct.type,
          title: clientAct.title,
          body: clientAct.body,
          timestamp: new Date(clientAct.timestamp),
          reminderDate: clientAct.reminderDate
            ? new Date(clientAct.reminderDate)
            : null,
          reminderRead: clientAct.reminderRead || false,
          reminderStatus: clientAct.reminderStatus || 'active',
          reminderPriority: clientAct.reminderPriority || 'MEDIUM',
          deleted: clientAct.deleted || false,
          crmSynced: false,
        })
        await existingAct.save()
      } else {
        // Si ya existe en MongoDB, actualizamos sus campos en caso de cambios locales no consolidados
        existingAct.leadId = resolvedLeadId as any
        existingAct.type = clientAct.type
        existingAct.title = clientAct.title
        existingAct.body = clientAct.body
        existingAct.timestamp = new Date(clientAct.timestamp)
        existingAct.reminderDate = clientAct.reminderDate
          ? new Date(clientAct.reminderDate)
          : null
        existingAct.reminderRead = clientAct.reminderRead || false
        existingAct.reminderStatus = clientAct.reminderStatus || 'active'
        existingAct.reminderPriority = clientAct.reminderPriority || 'MEDIUM'
        if (clientAct.deleted) {
          existingAct.deleted = true
        }
        existingAct.crmSynced = false
        await existingAct.save()
      }

      const realId = existingAct._id.toString()
      activityMappings.push({ tempId: clientAct.tempId, id: realId })
    }
  }

  const dealMappings: { tempId: string; id: string }[] = []

  // 4. Procesar deals (solicitudes de microcrédito)
  for (const clientDeal of deals) {
    let resolvedLeadId: string | null = null

    if (clientDeal.leadId) {
      const mapping = leadMappings.find((m) => m.tempId === clientDeal.leadId)
      if (mapping) {
        resolvedLeadId = mapping.id
      } else {
        resolvedLeadId = clientDeal.leadId
      }
    }

    if (resolvedLeadId && !mongoose.Types.ObjectId.isValid(resolvedLeadId)) {
      console.warn(
        `[pushClientChanges] Advertencia: leadId "${resolvedLeadId}" no es un ObjectId válido para Deal. Saltando.`,
      )
      continue
    }

    if (clientDeal.id) {
      if (clientDeal.deleted) {
        await Deal.findOneAndUpdate(
          { _id: clientDeal.id, userId },
          { deleted: true, crmSynced: false },
        )
      } else {
        await Deal.findOneAndUpdate(
          { _id: clientDeal.id, userId },
          {
            name: clientDeal.name,
            amount: clientDeal.amount,
            termMonths: clientDeal.termMonths,
            interestRate: clientDeal.interestRate,
            stage: clientDeal.stage,
            notes: clientDeal.notes,
            crmSynced: false,
          },
        )
      }
    } else if (clientDeal.tempId) {
      // Evitar duplicación si falló el ACK de la sincronización previa
      let existingDeal = await Deal.findOne({ tempId: clientDeal.tempId })
      if (!existingDeal) {
        existingDeal = new Deal({
          tempId: clientDeal.tempId,
          leadId: resolvedLeadId,
          userId,
          name: clientDeal.name,
          amount: clientDeal.amount,
          termMonths: clientDeal.termMonths,
          interestRate: clientDeal.interestRate,
          stage: clientDeal.stage,
          notes: clientDeal.notes,
          deleted: clientDeal.deleted || false,
          crmSynced: false,
        })
        await existingDeal.save()
      } else {
        existingDeal.leadId = resolvedLeadId as any
        existingDeal.name = clientDeal.name
        existingDeal.amount = clientDeal.amount
        existingDeal.termMonths = clientDeal.termMonths
        existingDeal.interestRate = clientDeal.interestRate
        existingDeal.stage = clientDeal.stage
        existingDeal.notes = clientDeal.notes
        if (clientDeal.deleted) {
          existingDeal.deleted = true
        }
        existingDeal.crmSynced = false
        await existingDeal.save()
      }
      const realId = existingDeal._id.toString()
      dealMappings.push({ tempId: clientDeal.tempId, id: realId })
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
    dealMappings,
  }
}

export async function pullServerUpdates(lastSyncTime: number) {
  const userId = await getUserIdOrThrow()
  await dbConnect()

  const user = await User.findById(userId)

  // Si el usuario es supervisor, obtenemos los IDs de los vendedores a su cargo para sincronizar también sus datos
  let userIdsToSync = [userId]
  const userRoles =
    user?.roles && user.roles.length > 0 ? user.roles : [user?.role || 'user']
  if (userRoles.includes('supervisor')) {
    const salespeople = await User.find({ supervisorId: userId }, '_id')
    const salespeopleIds = salespeople.map((sp) => sp._id.toString())
    userIdsToSync = [userId, ...salespeopleIds]
  }

  // Comprobar si la base de datos intermedia (MongoDB) está vacía de empresas o leads (contando activos y eliminados)
  const companyCount = await Company.countDocuments()
  const leadCount = user?.crmOwnerId
    ? await Lead.countDocuments({ userId: { $in: userIdsToSync } })
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
              // Buscar si ya existe el contacto en MongoDB para verificar cambios locales pendientes
              const existingLead = await Lead.findOne({
                $or: [
                  { crmId: crmLead.crmId },
                  { emailHash: hash(crmLead.email), userId, deleted: false },
                ],
              })

              const hasPendingChanges = existingLead?.crmSynced === false

              const leadDoc = await Lead.findOneAndUpdate(
                {
                  $or: [
                    { crmId: crmLead.crmId },
                    { emailHash: hash(crmLead.email), userId, deleted: false },
                  ],
                },
                {
                  $setOnInsert: {
                    userId: userId,
                    crmLastSyncAt: new Date(),
                    deleted: false,
                  },
                  $set: {
                    crmId: crmLead.crmId,
                    crmSynced: true,
                    // Si no tiene cambios locales pendientes, actualizamos los campos desde HubSpot a MongoDB
                    ...(hasPendingChanges
                      ? {}
                      : {
                          firstName: crmLead.firstName,
                          lastName: crmLead.lastName,
                          email: crmLead.email,
                          phone: crmLead.phone,
                          documentId: crmLead.documentId,
                        }),
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
                syncInvoicesForLead(doc, crmId, crm, userId),
              ),
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
    userId: { $in: userIdsToSync },
    updatedAt: { $gt: sinceDate },
  })

  // Sincronizar facturas, actividades y deals sólo para leads modificados/actualizados recientemente en segundo plano
  const activeLeads = await Lead.find({
    userId: { $in: userIdsToSync },
    deleted: false,
    updatedAt: { $gt: sinceDate },
  })
  if (activeLeads.length > 0) {
    import('@/lib/crm/factory')
      .then(({ CRMProviderFactory }) => {
        const crm = CRMProviderFactory.getProvider()
        crm
          .checkHealth()
          .then(async (isOnline) => {
            if (isOnline) {
              await Promise.all([
                ...activeLeads.map((lead) => {
                  if (lead.crmId) {
                    return syncInvoicesForLead(lead, lead.crmId, crm, userId)
                  }
                  return Promise.resolve()
                }),
                ...activeLeads.map((lead) => {
                  if (lead.crmId) {
                    return syncActivitiesForLead(lead, lead.crmId, crm, userId)
                  }
                  return Promise.resolve()
                }),
                ...activeLeads.map((lead) => {
                  if (lead.crmId) {
                    return syncDealsForLead(lead, lead.crmId, crm, userId)
                  }
                  return Promise.resolve()
                }),
              ])
            }
          })
          .catch((err) =>
            console.error(
              '[Sync Action Background] Error al validar salud del CRM:',
              err,
            ),
          )
      })
      .catch((err) =>
        console.error('[Sync Action Background] Error al cargar factory:', err),
      )
  }

  // Obtener facturas, actividades y deals actualizados desde la última sincronización
  const updatedInvoices = await Invoice.find({
    userId: { $in: userIdsToSync },
    updatedAt: { $gt: sinceDate },
  })

  const updatedActivities = await Activity.find({
    userId: { $in: userIdsToSync },
    updatedAt: { $gt: sinceDate },
  })

  const updatedDeals = await Deal.find({
    userId: { $in: userIdsToSync },
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
      documentId: l.documentId,
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
      tempId: act.tempId,
      leadId: act.leadId.toString(),
      userId: act.userId,
      type: act.type,
      title: act.title,
      body: act.body,
      timestamp: act.timestamp.getTime(),
      reminderDate: act.reminderDate ? act.reminderDate.getTime() : undefined,
      reminderRead: act.reminderRead,
      reminderStatus: act.reminderStatus || 'active',
      reminderPriority: act.reminderPriority || 'MEDIUM',
      deleted: act.deleted,
      createdAt: act.createdAt.getTime(),
      updatedAt: act.updatedAt.getTime(),
    })),
    deals: updatedDeals.map((d) => ({
      id: d._id.toString(),
      tempId: d.tempId,
      leadId: d.leadId.toString(),
      userId: d.userId,
      name: d.name,
      amount: d.amount,
      termMonths: d.termMonths,
      interestRate: d.interestRate,
      stage: d.stage,
      notes: d.notes,
      deleted: d.deleted,
      createdAt: d.createdAt.getTime(),
      updatedAt: d.updatedAt.getTime(),
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
    const hasOverdue = crmInvoices.some(
      (inv: CRMInvoice) => inv.status === 'OVERDUE',
    )
    const hasPending = crmInvoices.some(
      (inv: CRMInvoice) => inv.status === 'PENDING',
    )
    let scoring = 'A - Excelente'

    if (hasOverdue) {
      scoring = 'D - Deudor'
    } else if (hasPending) {
      scoring = 'B - Bueno'
    }

    // 4. Actualizar el scoring en el lead de MongoDB
    if (leadDoc.scoring !== scoring) {
      await Lead.updateOne({ _id: leadDoc._id }, { $set: { scoring } })
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
      const activeCrmIds = crmActivities
        .map((act) => act.crmId)
        .filter(Boolean) as string[]

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
          const isPendingDelete = await Activity.exists({
            crmId: act.crmId,
            deleted: true,
            crmSynced: false,
          })
          if (isPendingDelete) {
            continue
          }

          // Evitar sobreescribir con datos obsoletos del CRM si hay cambios locales pendientes de sincronizar
          const existingAct = await Activity.findOne({ crmId: act.crmId })
          if (existingAct) {
            if (!existingAct.crmSynced) {
              continue
            }
            // Evitar sobreescribir si hubo una actualización local muy reciente (dentro de los últimos 20 segundos)
            const timeSinceLastUpdate =
              Date.now() - existingAct.updatedAt.getTime()
            if (timeSinceLastUpdate < 20000) {
              continue
            }
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
                title: (existingAct && existingAct.type === 'WHATSAPP') ? existingAct.title : act.title,
                body: act.body,
                timestamp: new Date(act.timestamp),
                reminderDate: act.reminderDate
                  ? isNaN(Number(act.reminderDate))
                    ? new Date(act.reminderDate)
                    : new Date(Number(act.reminderDate))
                  : null,
                reminderRead: act.reminderRead || false,
                reminderStatus: act.reminderStatus || 'active',
                reminderPriority: act.reminderPriority || 'MEDIUM',
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

/**
 * Función auxiliar para sincronizar deals del lead desde HubSpot a MongoDB.
 */
export async function syncDealsForLead(
  leadDoc: ILeadSchema,
  crmLeadCrmId: string,
  crm: ICRMProvider,
  userId: string,
  options: { bypassRecencyGuard?: boolean } = {},
) {
  try {
    const crmDeals = await crm.fetchDealsByLead(crmLeadCrmId)

    if (crmDeals.length > 0) {
      const activeCrmIds = crmDeals
        .map((d) => d.crmId)
        .filter(Boolean) as string[]

      // 1. Los deals locales que no aparecen en la lista de asociados del contacto
      // pueden estar realmente borrados en el CRM, O simplemente haber perdido la
      // asociación con el contacto sin haberse borrado (pasó de verdad: un deal
      // creado mientras el contacto estaba temporalmente ausente del CRM quedó
      // huérfano y este código lo re-marcaba `deleted` en cada ciclo, sin fin,
      // aunque el deal siguiera existiendo — ver memoria project_deal_webhook_sync).
      // Por eso, antes de asumir "no asociado = borrado", intentamos autosanar
      // restableciendo la asociación; solo si el CRM confirma con 404 que el deal
      // ya no existe lo marcamos borrado de verdad.
      const missingLocalDeals = await Deal.find({
        leadId: leadDoc._id,
        crmSynced: true,
        crmId: { $nin: activeCrmIds },
      })

      for (const missingDeal of missingLocalDeals) {
        if (!missingDeal.crmId) continue
        try {
          await crm.associateDealWithLead(missingDeal.crmId, crmLeadCrmId)
          console.warn(
            `[syncDealsForLead] Deal ${missingDeal.crmId} no estaba asociado al contacto ${crmLeadCrmId}; asociación restablecida automáticamente (no se marca borrado).`,
          )
        } catch (assocErr: any) {
          const is404 =
            assocErr.status === 404 || assocErr.message?.includes('404')
          if (is404) {
            missingDeal.deleted = true
            await missingDeal.save()
          } else {
            console.warn(
              `[syncDealsForLead] No se pudo verificar/reasociar el deal ${missingDeal.crmId} (error no confirma que esté borrado, se deja como estaba):`,
              assocErr.message,
            )
          }
        }
      }

      // 2. Realizar upsert de los deals recuperados del CRM
      for (const d of crmDeals) {
        if (d.crmId) {
          const isPendingDelete = await Deal.exists({
            crmId: d.crmId,
            deleted: true,
            crmSynced: false,
          })
          if (isPendingDelete) {
            continue
          }

          // Evitar sobreescribir con datos obsoletos del CRM si hay cambios locales pendientes de sincronizar o actualizados recientemente
          const existingDeal = await Deal.findOne({ crmId: d.crmId })
          if (existingDeal) {
            if (!existingDeal.crmSynced) {
              continue
            }
            // Evitar sobreescribir si hubo una actualización local muy reciente (dentro de
            // los últimos 20 segundos). Este resguardo es para el polling de auto-sanación
            // en background; cuando la llamada viene de un webhook, el CRM es la fuente de
            // verdad del cambio en tiempo real y este resguardo no debe aplicar.
            if (!options.bypassRecencyGuard) {
              const timeSinceLastUpdate =
                Date.now() - existingDeal.updatedAt.getTime()
              if (timeSinceLastUpdate < 20000) {
                continue
              }
            }
          }

          let termMonths = 6
          let interestRate = 0
          let localStage: string | undefined = undefined

          if (d.description) {
            const match = d.description.match(/<!-- loan_metadata:(.*?) -->/)
            if (match) {
              try {
                const metadata = JSON.parse(match[1])
                termMonths = metadata.termMonths ?? 6
                interestRate = metadata.interestRate ?? 0
                localStage = metadata.localStage
              } catch (_) {}
            }
          }

          // 1. Obtener la etapa mapeada correspondiente al estado actual en HubSpot
          const hsStageToLocal: Record<string, string> = {
            appointmentscheduled: 'draft',
            'decisionmakerbought-in': 'under_evaluation',
            contractsent: 'approved',
            closedwon: 'disbursed',
            closedlost: 'refused',
          }
          const mappedStage = hsStageToLocal[d.stage] || 'draft'

          let resolvedStage = mappedStage

          // 2. Si el metadato localStage existe y coincide en su mapeo general a HubSpot con d.stage,
          // preservamos el localStage para diferenciar sub-etapas (disbursed vs completed, refused vs overdue).
          if (localStage) {
            const localToHs: Record<string, string> = {
              draft: 'appointmentscheduled',
              under_evaluation: 'decisionmakerbought-in',
              approved: 'contractsent',
              disbursed: 'closedwon',
              completed: 'closedwon',
              refused: 'closedlost',
              overdue: 'closedlost',
            }
            if (localToHs[localStage] === d.stage) {
              resolvedStage = localStage
            }
          }

          // El motor de salida (sync-engine.ts) escribe la description en HubSpot como
          // "Asesor: <userId>\nNotas: <texto>\n<!-- loan_metadata:... -->". Al traerla de
          // vuelta hay que extraer solo <texto> — quedarse con el bloque completo (bug
          // encontrado 18/8/2026) hace que las notas reales queden precedidas por
          // "Asesor: <id>\nNotas: " cada vez que un deal se importa/actualiza desde el CRM.
          let parsedNotes = ''
          if (d.description) {
            const withoutMetadata = d.description.split('\n<!--')[0]
            const notasMatch = withoutMetadata.match(/\nNotas: ([\s\S]*)$/)
            parsedNotes = notasMatch ? notasMatch[1] : withoutMetadata
          }

          await Deal.findOneAndUpdate(
            { crmId: d.crmId },
            {
              $setOnInsert: {
                leadId: leadDoc._id,
                userId,
                createdAt: new Date(),
              },
              $set: {
                name: d.name,
                amount: d.amount,
                termMonths,
                interestRate,
                stage: resolvedStage,
                notes: parsedNotes,
                crmSynced: true,
                deleted: false,
              },
            },
            { upsert: true, returnDocument: 'after' },
          )
        }
      }
    } else {
      await Deal.updateMany(
        { leadId: leadDoc._id, crmSynced: true },
        { $set: { deleted: true } },
      )
    }
  } catch (error) {
    console.error(
      `[syncDealsForLead] Error al sincronizar deals para lead ${leadDoc._id}:`,
      error,
    )
  }
}

export async function searchGlobalLeads(query: string) {
  await getUserIdOrThrow()
  await dbConnect()

  const cleanQuery = query.trim()
  if (!cleanQuery) return []

  // 1. Buscar en MongoDB local primero por hashes exactos (email o DNI)
  const cleanQueryLower = cleanQuery.toLowerCase()
  const mongoQuery: any = {
    deleted: false,
    $or: [
      { documentIdHash: hash(cleanQuery) },
      { emailHash: hash(cleanQueryLower) },
    ],
  }

  let localLeads = await Lead.find(mongoQuery).limit(20)

  // 2. Buscar en HubSpot e importar en caliente
  try {
    const { CRMProviderFactory } = await import('@/lib/crm/factory')
    const crm = CRMProviderFactory.getProvider()
    const isCrmOnline = await crm.checkHealth()

    if (isCrmOnline) {
      const crmLeads = await crm.searchLeads(cleanQuery)
      const importedIds: any[] = []
      for (const crmLead of crmLeads) {
        if (crmLead.crmId) {
          // Determinar dueño local
          let assignedUserId = 'system_fallback'
          if (crmLead.ownerId) {
            const matchedUser = await User.findOne({
              crmOwnerId: crmLead.ownerId,
            })
            if (matchedUser) {
              assignedUserId = String(matchedUser._id)
            }
          }

          const existingLead = await Lead.findOne({
            $or: [
              { crmId: crmLead.crmId },
              { emailHash: hash(crmLead.email?.toLowerCase()), deleted: false },
            ],
          })

          const hasPendingChanges = existingLead?.crmSynced === false

          const upsertedLead = await Lead.findOneAndUpdate(
            { crmId: crmLead.crmId },
            {
              $setOnInsert: {
                userId: assignedUserId,
                crmLastSyncAt: new Date(),
                deleted: false,
              },
              $set: {
                crmSynced: true,
                ...(hasPendingChanges
                  ? {}
                  : {
                      firstName: crmLead.firstName,
                      lastName: crmLead.lastName,
                      email: crmLead.email,
                      phone: crmLead.phone,
                      documentId: crmLead.documentId,
                    }),
              },
            },
            { upsert: true, new: true },
          )
          if (upsertedLead) importedIds.push(upsertedLead._id)
        }
      }

      // Volver a consultar MongoDB incluyendo tanto el match exacto por
      // hash como los leads recién importados desde HubSpot (que pueden
      // haber sido encontrados por nombre/teléfono, no solo DNI o email)
      localLeads = await Lead.find({
        deleted: false,
        $or: [
          { documentIdHash: hash(cleanQuery) },
          { emailHash: hash(cleanQueryLower) },
          { _id: { $in: importedIds } },
        ],
      }).limit(20)
    }
  } catch (err) {
    console.error(
      '[Global Search] Error al buscar y descargar contactos del CRM:',
      err,
    )
  }

  return localLeads.map((lead) => ({
    id: lead._id.toString(),
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    documentId: lead.documentId,
    companyId: lead.companyId?.toString() || null,
    userId: lead.userId,
    scoring: lead.scoring,
    createdAt: lead.createdAt.getTime(),
    updatedAt: lead.updatedAt.getTime(),
  }))
}

export async function getGlobalLeadDetails(leadId: string) {
  const currentUserId = await getUserIdOrThrow()
  await dbConnect()

  const lead = await Lead.findById(leadId)
  if (lead && lead.crmId) {
    try {
      const { CRMProviderFactory } = await import('@/lib/crm/factory')
      const crm = CRMProviderFactory.getProvider()
      const isCrmOnline = await crm.checkHealth()
      if (isCrmOnline) {
        // Sincronizar sub-entidades del lead desde HubSpot
        await Promise.all([
          syncInvoicesForLead(lead, lead.crmId, crm, lead.userId),
          syncActivitiesForLead(lead, lead.crmId, crm, lead.userId),
          syncDealsForLead(lead, lead.crmId, crm, lead.userId),
        ])
      }
    } catch (err) {
      console.error(
        '[Global Details] Error al sincronizar subentidades del lead:',
        err,
      )
    }
  }

  const invoices = await Invoice.find({ leadId })
  const activities = await Activity.find({ leadId, deleted: false })
  const deals = await Deal.find({ leadId, deleted: false })

  return {
    invoices: invoices.map((inv) => ({
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
    activities: activities.map((act) => ({
      id: act._id.toString(),
      crmId: act.crmId,
      leadId: act.leadId.toString(),
      userId: act.userId,
      type: act.type,
      title: act.title,
      body: act.body,
      timestamp: act.timestamp.getTime(),
      reminderDate: act.reminderDate ? act.reminderDate.getTime() : undefined,
      reminderRead: act.reminderRead,
      reminderStatus: act.reminderStatus || 'active',
      reminderPriority: act.reminderPriority || 'MEDIUM',
      createdAt: act.createdAt.getTime(),
      updatedAt: act.updatedAt.getTime(),
    })),
    deals: deals.map((d) => ({
      id: d._id.toString(),
      crmId: d.crmId,
      leadId: d.leadId.toString(),
      userId: d.userId,
      name: d.name,
      amount: d.amount,
      termMonths: d.termMonths,
      interestRate: d.interestRate,
      stage: d.stage,
      notes: d.notes,
      createdAt: d.createdAt.getTime(),
      updatedAt: d.updatedAt.getTime(),
    })),
  }
}
