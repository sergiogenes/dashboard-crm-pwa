'use client'

import React from 'react'
import { Calendar, Cloud, Database, Inbox } from 'lucide-react'
import { LocalDeal } from '@/lib/db'

export const getStageConfig = (stage: LocalDeal['stage']) => {
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
        style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold',
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
        style: 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold animate-pulse',
      }
    default:
      return {
        label: stage,
        style: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      }
  }
}

interface DealTableProps {
  filteredDeals: LocalDeal[]
  session: any
  advisors: Record<string, string>
  getBorrowerName: (leadId: string) => string
}

export default function DealTable({
  filteredDeals,
  session,
  advisors,
  getBorrowerName,
}: DealTableProps) {
  const isSupervisor = session?.user?.roles?.includes('supervisor')

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-4">
                Prestatario
              </th>
              {isSupervisor && (
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
                    {isSupervisor && (
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
                  colSpan={isSupervisor ? 8 : 7}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="h-8 w-8 text-slate-600" />
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
  )
}
