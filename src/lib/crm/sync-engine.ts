import dbConnect from '@/lib/mongodb'
import Company from '@/models/Company'
import Lead from '@/models/Lead'
import User from '@/models/User'
import Activity from '@/models/Activity'
import Deal from '@/models/Deal'
import { CRMProviderFactory } from './factory'

// Semáforo de bloqueo para evitar condiciones de carrera concurrentes
let isSyncing = false

/**
 * Motor de sincronización asíncrona (Outbound Sync Engine)
 * Procesa los cambios acumulados en MongoDB y los envía al CRM configurado.
 * Prioriza el procesamiento de empresas antes de contactos para asegurar
 * la consistencia relacional en las asociaciones.
 */
export async function syncMongoDBToCRM(): Promise<void> {
  if (isSyncing) {
    console.log('[Sync Engine] Sincronización saliente ya en curso. Ignorando ejecución concurrente.')
    return
  }

  isSyncing = true

  try {
    await dbConnect()
    const crm = CRMProviderFactory.getProvider()

    // 1. Verificar la disponibilidad del CRM
    const isCrmOnline = await crm.checkHealth()
    if (!isCrmOnline) {
      console.warn('[Sync Engine] El CRM no responde. Postponiendo sincronización.')
      return
    }

  // --- A. SINCRONIZACIÓN DE EMPRESAS ---
  const pendingCompanies = await Company.find({ crmSynced: false })

  for (const company of pendingCompanies) {
    try {
      // 1. Caso Borrado (Soft delete)
      if (company.deleted) {
        if (company.crmId) {
          await crm.deleteCompany(company.crmId)
        }
        company.crmSynced = true
        company.crmLastSyncAt = new Date()
        company.crmSyncError = undefined
        await company.save()
        continue
      }

      // 2. Caso Crear / Actualizar
      const crmId = await crm.upsertCompany({
        crmId: company.crmId,
        name: company.name,
        domain: company.domain,
      })

      company.crmId = crmId
      company.crmSynced = true
      company.crmSyncError = undefined
      company.crmLastSyncAt = new Date()
      await company.save()
    } catch (error: any) {
      console.error(`[Sync Engine] Error sincronizando empresa ${company._id}:`, error)

      // Distinguir errores de red o cuota (transitorios) de errores lógicos (permanentes)
      const isTransient =
        error.status === 429 ||
        (error.status >= 500 && error.status <= 599) ||
        error.message?.includes('fetch') ||
        error.message?.includes('ENOTFOUND')

      if (isTransient) {
        // Error de red: Abortamos la iteración de la cola completa para reintentar más tarde
        return
      } else {
        // Error lógico permanente: Marcamos como procesado en la cola para no atascar, pero reportamos error
        company.crmSynced = true
        company.crmSyncError = error.message || 'Error de validación persistente en CRM'
        await company.save()
      }
    }
  }

  // --- B. SINCRONIZACIÓN DE CONTACTOS (LEADS) ---
  const pendingLeads = await Lead.find({ crmSynced: false })

  for (const lead of pendingLeads) {
    try {
      // 1. Caso Borrado (Soft delete)
      if (lead.deleted) {
        if (lead.crmId) {
          await crm.deleteLead(lead.crmId)
        }
        lead.crmSynced = true
        lead.crmLastSyncAt = new Date()
        lead.crmSyncError = undefined
        await lead.save()
        continue
      }

      // 2. Caso Crear / Actualizar
      const user = await User.findById(lead.userId)
      const crmId = await crm.upsertLead({
        crmId: lead.crmId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        ownerId: user?.crmOwnerId,
      })

      lead.crmId = crmId

      // 3. Intentar asociación con Empresa
      if (lead.companyId) {
        const company = await Company.findById(lead.companyId)
        if (company && company.crmId) {
          await crm.associateLeadWithCompany(crmId, company.crmId)
        }
      }

      lead.crmSynced = true
      lead.crmSyncError = undefined
      lead.crmLastSyncAt = new Date()
      await lead.save()
    } catch (error: any) {
      console.error(`[Sync Engine] Error sincronizando lead ${lead._id}:`, error)

      const isTransient =
        error.status === 429 ||
        (error.status >= 500 && error.status <= 599) ||
        error.message?.includes('fetch') ||
        error.message?.includes('ENOTFOUND')

      if (isTransient) {
        return
      } else {
        lead.crmSynced = true
        lead.crmSyncError = error.message || 'Error de validación persistente en CRM'
        await lead.save()
      }
    }
  }

  // --- C. SINCRONIZACIÓN DE ACTIVIDADES ---
  const pendingActivities = await Activity.find({ crmSynced: false })

  for (const activity of pendingActivities) {
    try {
      if (activity.deleted) {
        if (activity.crmId) {
          await crm.deleteActivity(activity.crmId, activity.type)
        }
        activity.crmSynced = true
        await activity.save()
        continue
      }

      const lead = await Lead.findById(activity.leadId)
      if (!lead || !lead.crmId) {
        continue // Esperar a que el contacto se sincronice y tenga crmId
      }

      const crmId = await crm.createActivity(lead.crmId, {
        crmId: activity.crmId,
        type: activity.type,
        title: activity.title,
        body: activity.body,
        timestamp: activity.timestamp.toISOString(),
        reminderDate: activity.reminderDate ? String(activity.reminderDate.getTime()) : undefined,
        reminderRead: activity.reminderRead || false,
      })

      activity.crmId = crmId
      activity.crmSynced = true
      await activity.save()
    } catch (error: any) {
      console.error(`[Sync Engine] Error sincronizando actividad ${activity._id}:`, error)
      const isTransient = error.status === 429 || (error.status >= 500 && error.status <= 599) || error.message?.includes('fetch') || error.message?.includes('ENOTFOUND')
      if (isTransient) {
        return
      } else {
        activity.crmSynced = true
        await activity.save()
      }
    }
  }

  // --- D. SINCRONIZACIÓN DE DEALS (SOLICITUDES DE MICROCRÉDITO) ---
  const pendingDeals = await Deal.find({ crmSynced: false })

  for (const deal of pendingDeals) {
    try {
      // 1. Caso Borrado (Soft delete)
      if (deal.deleted) {
        if (deal.crmId) {
          await crm.deleteDeal(deal.crmId)
        }
        deal.crmSynced = true
        deal.crmLastSyncAt = new Date()
        deal.crmSyncError = undefined
        await deal.save()
        continue
      }

      // 2. Caso Crear / Actualizar
      const lead = await Lead.findById(deal.leadId)
      if (!lead || !lead.crmId) {
        continue // Esperar a que el contacto asociado tenga crmId
      }

      // Obtener el Owner ID (asesor / usuario del dashboard)
      const user = await User.findById(deal.userId)
      const ownerId = user?.crmOwnerId || undefined

      // Empaquetar metadatos de microcrédito en la descripción
      const description = `Asesor: ${deal.userId}\nNotas: ${deal.notes || ''}\n<!-- loan_metadata:{"termMonths":${deal.termMonths},"interestRate":${deal.interestRate},"localStage":"${deal.stage}"} -->`

      const crmId = await crm.upsertDeal({
        crmId: deal.crmId,
        name: deal.name,
        amount: deal.amount,
        stage: deal.stage,
        description,
        ownerId,
      })

      const isNew = !deal.crmId
      deal.crmId = crmId

      // 3. Si es nuevo, asociarlo con el Contacto
      if (isNew) {
        await crm.associateDealWithLead(crmId, lead.crmId)
      }

      deal.crmSynced = true
      deal.crmSyncError = undefined
      deal.crmLastSyncAt = new Date()
      await deal.save()
    } catch (error: any) {
      console.error(`[Sync Engine] Error sincronizando deal ${deal._id}:`, error)

      const isTransient =
        error.status === 429 ||
        (error.status >= 500 && error.status <= 599) ||
        error.message?.includes('fetch') ||
        error.message?.includes('ENOTFOUND')

      if (isTransient) {
        return // Detener y reintentar después
      } else {
        deal.crmSynced = true
        deal.crmSyncError = error.message || 'Error de validación de Deal en CRM'
        await deal.save()
      }
    }
  }
  } finally {
    isSyncing = false
  }
}
