'use client'

import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '@/lib/db'
import Link from 'next/link'
import SupervisorDashboard from '@/components/SupervisorDashboard'
import {
  Users,
  Building2,
  Percent,
  Cloud,
  CloudOff,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  History,
  ShieldCheck,
} from 'lucide-react'

export default function DashboardHome() {
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

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="animate-pulse text-sm font-medium">
          Cargando dashboard...
        </p>
      </div>
    )
  }

  // Renderizar condicionalmente el panel del supervisor
  if (session?.user?.roles?.includes('supervisor')) {
    return <SupervisorDashboard />
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Saludo de Bienvenida */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            ¡Hola, {session?.user?.name || 'Usuario'}!
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Aquí tienes un resumen de la actividad de tu CRM en modo híbrido
            offline/nube.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Badge Red/PWA */}
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              navigator.onLine
                ? 'border-emerald-500/10 bg-emerald-500/5 text-emerald-400'
                : 'border-amber-500/10 bg-amber-500/5 text-amber-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${navigator.onLine ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`}
            />
            <span>{navigator.onLine ? 'Online' : 'Offline'}</span>
          </div>

          {/* Badge Sync Rate */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-400">
            <span className="font-bold text-white">{syncRate}%</span>
            <span>
              Sync ({totalSynced}/{totalRecords})
            </span>
          </div>

          {/* Badge MFA */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>MFA</span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Principales (KPIs) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total de Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Leads
          </p>
          <h3 className="mt-2 text-2xl font-extrabold text-white">
            {totalLeads}
          </h3>
          <span className="mt-1 block text-[9px] text-slate-500">
            Base local activa
          </span>
        </div>

        {/* Nuevos Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Nuevos
          </p>
          <h3 className="mt-2 text-2xl font-extrabold text-blue-400">
            {countNew}
          </h3>
          <span className="mt-1 block text-[9px] text-slate-500">
            Sin contactar
          </span>
        </div>

        {/* Leads en Proceso */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            En Proceso
          </p>
          <h3 className="mt-2 text-2xl font-extrabold text-amber-400">
            {countInProcess}
          </h3>
          <span className="mt-1 block text-[9px] text-slate-500">
            Bajo evaluación
          </span>
        </div>

        {/* Aprobados */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Aprobados
          </p>
          <h3 className="mt-2 text-2xl font-extrabold text-emerald-400">
            {countApproved}
          </h3>
          <span className="mt-1 block text-[9px] text-slate-500">
            Créditos vigentes
          </span>
        </div>

        {/* Rechazados */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Rechazados
          </p>
          <h3 className="mt-2 text-2xl font-extrabold text-rose-400">
            {countRejected}
          </h3>
          <span className="mt-1 block text-[9px] text-slate-500">
            No calificados
          </span>
        </div>

        {/* Conversion Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Conversión
          </p>
          <h3 className="mt-2 text-2xl font-extrabold text-indigo-400">
            {conversionRate}%
          </h3>
          <span className="mt-1 block text-[9px] text-slate-500">
            Aprobados / Total
          </span>
        </div>
      </div>

      {/* Widgets Principales */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Panel Izquierdo: Gráfico de Pipeline de Leads */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                Embudo de Ventas (Pipeline)
              </h4>
            </div>
            <span className="rounded border border-indigo-500/20 bg-indigo-500/5 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
              Datos Reales
            </span>
          </div>

          <div className="flex flex-col items-center justify-center space-y-3.5 py-4">
            {totalLeads === 0 ? (
              <p className="py-12 text-center text-xs text-slate-500">
                Registra leads en la pestaña de Contactos para inicializar el
                embudo.
              </p>
            ) : (
              <>
                {/* Nivel: Nuevos */}
                <div
                  className="animate-in slide-in-from-top-4 relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-blue-500/35 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 px-5 py-3 shadow-md transition-all duration-300 hover:from-blue-500/25 hover:to-indigo-500/25"
                  style={{ width: '100%' }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-blue-500/10"
                    style={{ width: `${pctNew}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-300">
                      Nuevos (Sin Contactar)
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-white">
                      {countNew} Leads
                    </span>
                  </div>
                  <span className="z-10 rounded border border-blue-500/20 bg-blue-950/40 px-2 py-0.5 text-xs font-black text-blue-400">
                    {pctNew}%
                  </span>
                </div>

                {/* Nivel: En Proceso */}
                <div
                  className="animate-in slide-in-from-top-4 relative flex items-center justify-between overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-5 py-3 shadow-md transition-all delay-75 duration-300 hover:from-amber-500/25 hover:to-orange-500/25"
                  style={{ width: '85%' }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-amber-500/10"
                    style={{ width: `${pctInProcess}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-amber-300">
                      En Proceso / Evaluados
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-white">
                      {countInProcess} Leads
                    </span>
                  </div>
                  <span className="z-10 rounded border border-amber-500/20 bg-amber-950/40 px-2 py-0.5 text-xs font-black text-amber-400">
                    {pctInProcess}%
                  </span>
                </div>

                {/* Nivel: Aprobados */}
                <div
                  className="animate-in slide-in-from-top-4 relative flex items-center justify-between overflow-hidden rounded-xl border border-emerald-500/35 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-5 py-3 shadow-md transition-all delay-150 duration-300 hover:from-emerald-500/25 hover:to-teal-500/25"
                  style={{ width: '70%' }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-emerald-500/10"
                    style={{ width: `${pctApproved}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                      Aprobados / Cerrados
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-white">
                      {countApproved} Leads
                    </span>
                  </div>
                  <span className="z-10 rounded border border-emerald-500/20 bg-emerald-950/40 px-2 py-0.5 text-xs font-black text-emerald-400">
                    {pctApproved}%
                  </span>
                </div>

                {/* Nivel: Rechazados */}
                <div
                  className="animate-in slide-in-from-top-4 relative flex items-center justify-between overflow-hidden rounded-xl border border-rose-500/35 bg-gradient-to-r from-rose-500/20 to-red-500/20 px-5 py-3 shadow-md transition-all delay-200 duration-300 hover:from-rose-500/25 hover:to-red-500/25"
                  style={{ width: '55%' }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-rose-500/10"
                    style={{ width: `${pctRejected}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-rose-300">
                      Rechazados / Perdidos
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-white">
                      {countRejected} Leads
                    </span>
                  </div>
                  <span className="z-10 rounded border border-rose-500/20 bg-rose-950/40 px-2 py-0.5 text-xs font-black text-rose-400">
                    {pctRejected}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Panel Derecho: Acciones Rápidas */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              Acciones Rápidas
            </h4>
          </div>

          <Link
            href="/contacts"
            className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/40"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-400">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">
                  Gestionar Contactos
                </p>
                <p className="text-[10px] text-slate-500">
                  Crea, edita y asocia leads
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/companies"
            className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/40"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-400">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">
                  Gestionar Empresas
                </p>
                <p className="text-[10px] text-slate-500">
                  Crea corporativos asociados
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Actividades Recientes */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              Últimos Cambios Locales
            </h4>
          </div>
          <span className="text-[10px] text-slate-500">
            Sincronización en segundo plano activa
          </span>
        </div>

        <div className="divide-y divide-slate-800/30">
          {recentChanges.length > 0 ? (
            recentChanges.map((change) => {
              const isLead = change.entityType === 'lead'
              const href = isLead
                ? `/contacts?leadId=${change.id || change.tempId}`
                : `/companies`
              const name = isLead
                ? `${change.firstName} ${change.lastName}`
                : change.name
              const subtitle = isLead
                ? change.email
                : change.domain || 'Empresa'
              const initials = isLead
                ? `${change.firstName?.[0] || ''}${change.lastName?.[0] || ''}`.toUpperCase()
                : (change.name?.[0] || 'E').toUpperCase()

              return (
                <Link
                  key={change.id || change.tempId}
                  href={href}
                  className="group -mx-3 flex cursor-pointer items-center justify-between rounded-xl px-3 py-3.5 transition-all first:pt-0 last:pb-0 hover:bg-slate-900/40"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8.5 w-8.5 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isLead
                          ? 'bg-indigo-500/10 text-indigo-300 group-hover:bg-indigo-500/20 group-hover:text-indigo-400'
                          : 'bg-violet-500/10 text-violet-300 group-hover:bg-violet-500/20 group-hover:text-violet-400'
                      }`}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white transition-colors group-hover:text-indigo-400">
                          {name}
                        </p>
                        <span
                          className={`py-0.2 inline-flex items-center rounded-md border px-1.5 text-[8px] font-semibold ${
                            isLead
                              ? 'border-indigo-500/10 bg-indigo-500/5 text-indigo-400'
                              : 'border-violet-500/10 bg-violet-500/5 text-violet-400'
                          }`}
                        >
                          {isLead ? 'Contacto' : 'Empresa'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">{subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        change.synced
                          ? 'border border-emerald-500/10 bg-emerald-500/10 text-emerald-400'
                          : 'animate-pulse border border-amber-500/10 bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {change.synced ? 'Sincronizado' : 'Solo Local'}
                    </span>
                    <p className="mt-1 text-[9px] text-slate-500">
                      Actualizado:{' '}
                      {new Date(
                        change.updatedAt || Date.now(),
                      ).toLocaleTimeString()}
                    </p>
                  </div>
                </Link>
              )
            })
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">
              No hay cambios locales recientes registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
