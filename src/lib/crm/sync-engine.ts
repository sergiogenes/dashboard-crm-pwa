import dbConnect from '@/lib/mongodb'
import Company from '@/models/Company'
import Lead from '@/models/Lead'
import User from '@/models/User'
import { CRMProviderFactory } from './factory'

/**
 * Motor de sincronización asíncrona (Outbound Sync Engine)
 * Procesa los cambios acumulados en MongoDB y los envía al CRM configurado.
 * Prioriza el procesamiento de empresas antes de contactos para asegurar
 * la consistencia relacional en las asociaciones.
 */
export async function syncMongoDBToCRM(): Promise<void> {
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
}
