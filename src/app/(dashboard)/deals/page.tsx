'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb, LocalDeal } from '@/lib/db'
import {
  Wallet,
  Search,
  Filter,
  Cloud,
  Database,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Inbox,
} from 'lucide-react'
import { useEffect } from 'react'
import { getSalespeople } from '@/app/actions/supervisor'

export default function DealsPage() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Estados de Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStage, setFilterStage] = useState<string>('ALL')
  const [advisors, setAdvisors] = useState<Record<string, string>>({})

  // Cargar nombres de asesores (vendedores)
  useEffect(() => {
    const fetchAdvisors = async () => {
      try {
        const initialAdvisors: Record<string, string> = {}
        if (userId) {
          initialAdvisors[userId] = session?.user?.name || 'Yo'
        }

        if (session?.user?.roles?.includes('supervisor')) {
          const people = await getSalespeople()
          people.forEach((p) => {
            initialAdvisors[p.id] = p.name
          })
        }
        setAdvisors(initialAdvisors)
      } catch (err) {
        console.error('Error al cargar asesores:', err)
      }
    }

    if (userId) {
      fetchAdvisors()
    }
  }, [userId, session])

  // 1. Obtener reactivamente todas las solicitudes de préstamo (Deals) del asesor (o de su equipo si es supervisor)
  const deals = useLiveQuery(
    async () => {
      if (!userId) return []
      if (session?.user?.roles?.includes('supervisor')) {
        return await localDb.deals.filter((d) => d.deleted !== true).toArray()
      }
      return await localDb.deals
        .filter((d) => d.userId === userId && d.deleted !== true)
        .toArray()
    },
    [userId, session],
    [],
  )

  // 2. Obtener reactivamente todos los Leads locales (para cruzar nombres sin importar propietario)
  const leads = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.leads.filter((l) => l.deleted !== true).toArray()
    },
    [userId],
    [],
  )

  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="animate-pulse text-sm font-medium">
          Cargando solicitudes...
        </p>
      </div>
    )
  }

  // Resolver el nombre del prestatario asociado
  const getBorrowerName = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId || l.tempId === leadId)
    return lead ? `${lead.firstName} ${lead.lastName}` : 'Cargando contacto...'
  }

  // Formatear estados a etiquetas legibles y estilos CSS de color premium
  const getStageConfig = (stage: LocalDeal['stage']) => {
    switch (stage) {
      case 'draft':
        return {
          label: 'Borrador',
          style: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        }
      case 'under_evaluation':
        return {
          label: 'Evaluación',
          style: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        }
      case 'approved':
        return {
          label: 'Aprobado',
          style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        }
      case 'disbursed':
        return {
          label: 'Desembolsado',
          style:
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold',
        }
      case 'completed':
        return {
          label: 'Completado',
          style: 'bg-teal-500/10 text-teal-400 border-teal-500/20 font-bold',
        }
      case 'refused':
        return {
          label: 'Rechazado',
          style: 'bg-red-500/10 text-red-400 border-red-500/20 font-bold',
        }
      case 'overdue':
        return {
          label: 'En Mora',
          style:
            'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold animate-pulse',
        }
      default:
        return {
          label: stage,
          style: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        }
    }
  }

  // Filtrado y Búsqueda
  const filteredDeals = deals.filter((deal) => {
    const borrower = getBorrowerName(deal.leadId).toLowerCase()
    const matchesSearch =
      borrower.includes(searchTerm.toLowerCase()) ||
      (deal.notes &&
        deal.notes.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStage =
      filterStage === 'ALL' ? true : deal.stage === filterStage

    return matchesSearch && matchesStage
  })

  // Métricas Rápidas
  const totalApplied = deals.reduce((sum, d) => sum + d.amount, 0)
  const activeLoans = deals.filter(
    (d) =>
      d.stage === 'draft' ||
      d.stage === 'under_evaluation' ||
      d.stage === 'approved',
  )
  const totalActiveAmount = activeLoans.reduce((sum, d) => sum + d.amount, 0)

  const disbursedLoans = deals.filter(
    (d) => d.stage === 'disbursed' || d.stage === 'completed',
  )
  const totalDisbursedAmount = disbursedLoans.reduce(
    (sum, d) => sum + d.amount,
    0,
  )

  const overdueCount = deals.filter((d) => d.stage === 'overdue').length

  return (
    <div className="space-y-6">
      {/* Sección de Encabezado */}
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          <Wallet className="h-8 w-8 text-indigo-400" />
          Solicitudes y Contratos (Deals)
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Monitor de solicitudes de microcréditos y estado del flujo de
          aprobación en el CRM.
        </p>
      </div>

      {/* Tarjetas de Métricas (Dashboard Superior) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Métrica 1: Total Solicitado */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Solicitado
            </span>
            <span className="mt-1 block text-xl font-bold text-white">
              $
              {totalApplied.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              {deals.length} solicitudes totales
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-indigo-400">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 2: En Proceso de Aprobación */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              En Evaluación
            </span>
            <span className="mt-1 block text-xl font-bold text-indigo-400">
              $
              {totalActiveAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              {activeLoans.length} solicitudes activas
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-indigo-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 3: Desembolsado */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Desembolsado
            </span>
            <span className="mt-1 block text-xl font-bold text-emerald-400">
              $
              {totalDisbursedAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              {disbursedLoans.length} créditos vigentes
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 4: Mora / Alerta */}
        <div
          className={`flex items-center justify-between rounded-2xl border p-5 backdrop-blur-md transition-colors ${
            overdueCount > 0
              ? 'border-rose-500/20 bg-rose-500/5'
              : 'border-slate-800 bg-slate-900/10'
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Créditos en Mora
            </span>
            <span
              className={`mt-1 block text-xl font-bold ${overdueCount > 0 ? 'text-rose-500' : 'text-white'}`}
            >
              {overdueCount}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              Requieren gestión urgente
            </span>
          </div>
          <div
            className={`rounded-xl border p-2.5 ${
              overdueCount > 0
                ? 'animate-pulse border-rose-500/20 bg-rose-500/10 text-rose-400'
                : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Buscador y Barra de Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* Buscador de Prestatario / Comentarios */}
          <div className="relative w-full sm:flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              placeholder="Buscar por prestatario o notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Filtro por Etapa */}
          <div className="relative w-full sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="block w-full cursor-pointer appearance-none rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Todas las etapas</option>
              <option value="draft">Borrador</option>
              <option value="under_evaluation">Evaluación de Riesgo</option>
              <option value="approved">Aprobado</option>
              <option value="disbursed">Desembolsado</option>
              <option value="completed">Completado / Pagado</option>
              <option value="refused">Rechazado</option>
              <option value="overdue">En Mora</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-slate-500">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Monitor - Tabla Desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-4">
                  Prestatario
                </th>
                {session?.user?.roles?.includes('supervisor') && (
                  <th scope="col" className="px-6 py-4">
                    Asesor
                  </th>
                )}
                <th scope="col" className="px-6 py-4">
                  Monto Solicitado
                </th>
                <th scope="col" className="px-6 py-4">
                  Plazo
                </th>
                <th scope="col" className="px-6 py-4">
                  Tasa (%)
                </th>
                <th scope="col" className="px-6 py-4">
                  Estado (CRM)
                </th>
                <th scope="col" className="px-6 py-4">
                  Registro / Sync
                </th>
                <th scope="col" className="px-6 py-4">
                  Notas Justificación
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-transparent">
              {filteredDeals.length > 0 ? (
                filteredDeals.map((deal) => {
                  const stageConfig = getStageConfig(deal.stage)
                  return (
                    <tr
                      key={deal.id || deal.tempId}
                      className="transition-colors hover:bg-slate-900/40"
                    >
                      <td className="px-6 py-4 font-semibold text-white">
                        {getBorrowerName(deal.leadId)}
                      </td>
                      {session?.user?.roles?.includes('supervisor') && (
                        <td className="text-slate-350 px-6 py-4 text-xs font-semibold">
                          {advisors[deal.userId] || 'Cargando asesor...'}
                        </td>
                      )}
                      <td className="px-6 py-4 font-mono font-medium text-white">
                        ${deal.amount.toLocaleString()} USD
                      </td>
                      <td className="text-slate-350 px-6 py-4">
                        {deal.termMonths} meses
                      </td>
                      <td className="text-slate-350 px-6 py-4">
                        {deal.interestRate}%
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageConfig.style}`}
                        >
                          {stageConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(deal.createdAt).toLocaleDateString()}
                          </span>
                          {deal.synced ? (
                            <span className="py-0.2 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 text-[9px] font-medium text-emerald-400">
                              <Cloud className="h-2.5 w-2.5" />
                              Sincronizado
                            </span>
                          ) : (
                            <span className="py-0.2 inline-flex w-fit animate-pulse items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 text-[9px] font-medium text-amber-400">
                              <Database className="h-2.5 w-2.5" />
                              Local
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="max-w-xs truncate px-6 py-4 font-mono text-xs text-slate-400"
                        title={deal.notes}
                      >
                        {deal.notes || '-'}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="text-slate-650 h-8 w-8" />
                      <p>
                        No se encontraron solicitudes de crédito registradas.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monitor - Vista Móvil (Tarjetas) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredDeals.length > 0 ? (
          filteredDeals.map((deal) => {
            const stageConfig = getStageConfig(deal.stage)
            return (
              <div
                key={deal.id || deal.tempId}
                className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/20 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {getBorrowerName(deal.leadId)}
                    </h3>
                    {session?.user?.roles?.includes('supervisor') && (
                      <span className="mt-0.5 block text-[10px] font-semibold text-indigo-400">
                        Asesor: {advisors[deal.userId] || 'Cargando asesor...'}
                      </span>
                    )}
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                      Registro: {new Date(deal.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${stageConfig.style}`}
                  >
                    {stageConfig.label}
                  </span>
                </div>

                <div className="border-slate-850 grid grid-cols-3 gap-2 border-y py-2">
                  <div>
                    <span className="text-slate-550 block text-[8px] uppercase">
                      Monto
                    </span>
                    <span className="mt-0.5 block font-mono text-xs font-bold text-white">
                      ${deal.amount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-550 block text-[8px] uppercase">
                      Plazo
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-300">
                      {deal.termMonths} meses
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-550 block text-[8px] uppercase">
                      Interés
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-300">
                      {deal.interestRate}%
                    </span>
                  </div>
                </div>

                {deal.notes && (
                  <p className="rounded border border-slate-900/50 bg-slate-950 p-2 font-mono text-[11px] leading-relaxed text-slate-400">
                    {deal.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 text-[10px]">
                  <span className="text-slate-500">
                    Estado de Sincronización
                  </span>
                  {deal.synced ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400">
                      <Cloud className="h-3 w-3" />
                      Cloud
                    </span>
                  ) : (
                    <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-400">
                      <Database className="h-3 w-3" />
                      Local
                    </span>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-slate-550 py-12 text-center">
            <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-700" />
            <p className="text-xs">No se encontraron solicitudes.</p>
          </div>
        )}
      </div>
    </div>
  )
}
