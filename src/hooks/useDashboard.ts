'use client'

import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '@/lib/db'

export function useDashboard() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // 1. Obtener reactivamente todas las Empresas activas desde Dexie
  const companies = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.companies.filter((c) => c.deleted !== true).toArray()
    },
    [userId],
    [],
  )

  // 2. Obtener reactivamente todos los Leads activos desde Dexie
  const leads = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.leads
        .filter((l) => l.userId === userId && l.deleted !== true)
        .toArray()
    },
    [userId],
    [],
  )

  // 3. Obtener reactivamente todas las solicitudes de préstamo (Deals) activas desde Dexie
  const deals = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.deals
        .filter((d) => d.userId === userId && d.deleted !== true)
        .toArray()
    },
    [userId],
    [],
  )

  // 4. Obtener reactivamente todas las actividades activas del usuario desde Dexie
  const activities = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.activities
        .filter((a) => a.userId === userId && a.deleted !== true)
        .toArray()
    },
    [userId],
    [],
  )

  // Estadísticas generales y sincronización
  const totalLeads = leads?.length || 0
  const totalCompanies = companies?.length || 0

  const syncedLeads = leads?.filter((l) => l.synced === true).length || 0
  const syncedCompanies =
    companies?.filter((c) => c.synced === true).length || 0
  const totalSynced = syncedLeads + syncedCompanies
  const totalRecords = totalLeads + totalCompanies

  const syncRate =
    totalRecords > 0 ? Math.round((totalSynced / totalRecords) * 100) : 100

  // Agrupar deals por leadId
  const approvedLeadIds = new Set<string>()
  const rejectedLeadIds = new Set<string>()
  const inProcessLeadIds = new Set<string>()

  deals?.forEach((deal) => {
    if (
      deal.stage === 'approved' ||
      deal.stage === 'disbursed' ||
      deal.stage === 'completed'
    ) {
      approvedLeadIds.add(deal.leadId)
    } else if (deal.stage === 'refused') {
      rejectedLeadIds.add(deal.leadId)
    } else if (deal.stage === 'under_evaluation' || deal.stage === 'draft') {
      inProcessLeadIds.add(deal.leadId)
    }
  })

  // Agrupar actividades por leadId para marcar contactos contactados como "En Proceso"
  const contactedLeadIds = new Set<string>()
  activities?.forEach((act) => {
    contactedLeadIds.add(act.leadId)
  })

  // Resolver categorías de leads de forma determinista
  let countApproved = 0
  let countRejected = 0
  let countInProcess = 0
  let countNew = 0

  leads?.forEach((lead) => {
    const leadKey = lead.id || lead.tempId || ''
    if (approvedLeadIds.has(leadKey)) {
      countApproved++
    } else if (inProcessLeadIds.has(leadKey) || contactedLeadIds.has(leadKey)) {
      countInProcess++
    } else if (rejectedLeadIds.has(leadKey)) {
      countRejected++
    } else {
      countNew++
    }
  })

  // Tasas de conversión y porcentajes reales
  const conversionRate =
    totalLeads > 0 ? Math.round((countApproved / totalLeads) * 100) : 0
  const pctNew = totalLeads > 0 ? Math.round((countNew / totalLeads) * 100) : 0
  const pctInProcess =
    totalLeads > 0 ? Math.round((countInProcess / totalLeads) * 100) : 0
  const pctApproved =
    totalLeads > 0 ? Math.round((countApproved / totalLeads) * 100) : 0
  const pctRejected =
    totalLeads > 0 ? Math.round((countRejected / totalLeads) * 100) : 0

  // Obtener cambios locales recientes (últimos 5 leads/empresas ordenados por updatedAt desc)
  const recentChanges = [
    ...(leads || []).map((l) => ({ ...l, entityType: 'lead' as const })),
    ...(companies || []).map((c) => ({ ...c, entityType: 'company' as const })),
  ]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5)

  return {
    status,
    userId,
    session,
    totalLeads,
    totalCompanies,
    totalSynced,
    totalRecords,
    syncRate,
    countNew,
    countInProcess,
    countApproved,
    countRejected,
    conversionRate,
    pctNew,
    pctInProcess,
    pctApproved,
    pctRejected,
    recentChanges,
  }
}
