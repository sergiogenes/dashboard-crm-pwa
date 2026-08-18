'use client'

import React from 'react'
import { Calendar, Cloud, Database, Inbox } from 'lucide-react'
import { LocalDeal } from '@/lib/db'
import { getDealStageConfig } from '@/lib/theme/status'
import { formatGs } from '@/lib/format'

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
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-ink-2">
          <thead className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
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
                Fecha de Creación
              </th>
              <th scope="col" className="px-6 py-4">
                Sync
              </th>
              <th scope="col" className="px-6 py-4">
                Notas Justificación
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-2 bg-transparent">
            {filteredDeals.length > 0 ? (
              filteredDeals.map((deal) => {
                const stageConfig = getDealStageConfig(deal.stage)
                return (
                  <tr
                    key={deal.id || deal.tempId}
                    className="transition-colors hover:bg-surface-2"
                  >
                    <td className="px-6 py-4 font-semibold text-ink">
                      {getBorrowerName(deal.leadId)}
                    </td>
                    {isSupervisor && (
                      <td className="text-ink-2 px-6 py-4 text-xs font-semibold">
                        {advisors[deal.userId] || 'Cargando asesor...'}
                      </td>
                    )}
                    <td className="px-6 py-4 font-mono font-medium text-ink">
                      {formatGs(deal.amount)}
                    </td>
                    <td className="text-ink-2 px-6 py-4">
                      {deal.termMonths} meses
                    </td>
                    <td className="text-ink-2 px-6 py-4">
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
                      <span className="flex items-center gap-1 font-mono text-xs text-ink-2">
                        <Calendar className="h-3 w-3 text-ink-3" />
                        {new Date(deal.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {deal.synced ? (
                        <span className="py-0.2 inline-flex w-fit items-center gap-1 rounded-full border border-ok-bd bg-ok-bg px-2 text-[9px] font-medium text-ok">
                          <Cloud className="h-2.5 w-2.5" />
                          Sincronizado
                        </span>
                      ) : (
                        <span className="py-0.2 inline-flex w-fit animate-pulse items-center gap-1 rounded-full border border-warn-bd bg-warn-bg px-2 text-[9px] font-medium text-warn">
                          <Database className="h-2.5 w-2.5" />
                          Local
                        </span>
                      )}
                    </td>
                    <td
                      className="max-w-xs truncate px-6 py-4 font-mono text-xs text-ink-2"
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
                  colSpan={isSupervisor ? 9 : 8}
                  className="px-6 py-12 text-center text-ink-3"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="h-8 w-8 text-ink-3" />
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
