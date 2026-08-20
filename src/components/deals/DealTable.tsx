'use client'

import React from 'react'
import { Calendar, Cloud, Database, Inbox } from 'lucide-react'
import { LocalDeal } from '@/lib/db'
import { getDealStageConfig } from '@/lib/theme/status'
import { formatGs } from '@/lib/format'
import { useConfigurableColumns, ConfigurableColumn } from '@/hooks/useConfigurableColumns'
import ColumnPicker from '@/components/ColumnPicker'

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

  // Columnas configurables: "Prestatario" y "Monto Solicitado" quedan fijas
  // (identidad de la fila + el dato más consultado). "Asesor" solo aplica
  // si el que mira es supervisor. Mismo hook/componente que Contactos (#11).
  const configurableColumns: ConfigurableColumn[] = [
    ...(isSupervisor
      ? [{ key: 'advisor', label: 'Asesor', defaultOn: true }]
      : []),
    { key: 'termMonths', label: 'Plazo', defaultOn: true },
    { key: 'interestRate', label: 'Tasa (%)', defaultOn: true },
    { key: 'stage', label: 'Estado (CRM)', defaultOn: true },
    { key: 'createdAt', label: 'Fecha de Creación', defaultOn: true },
    { key: 'sync', label: 'Sync', defaultOn: false, devOnly: true },
    { key: 'notes', label: 'Notas Justificación', defaultOn: true },
  ]

  const { isVisible, toggleColumn } = useConfigurableColumns(
    'dealsTable.visibleColumns',
    configurableColumns,
  )

  // Prestatario + Monto Solicitado (fijas) + columna del engranaje + configurables activas
  const columnCount = 3 + configurableColumns.filter((c) => isVisible(c.key)).length

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-ink-2">
          <thead className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            <tr>
              <th scope="col" className="px-6 py-4">
                Prestatario
              </th>
              {isSupervisor && isVisible('advisor') && (
                <th scope="col" className="px-6 py-4">
                  Asesor
                </th>
              )}
              <th scope="col" className="px-6 py-4">
                Monto Solicitado
              </th>
              {isVisible('termMonths') && (
                <th scope="col" className="px-6 py-4">
                  Plazo
                </th>
              )}
              {isVisible('interestRate') && (
                <th scope="col" className="px-6 py-4">
                  Tasa (%)
                </th>
              )}
              {isVisible('stage') && (
                <th scope="col" className="px-6 py-4">
                  Estado (CRM)
                </th>
              )}
              {isVisible('createdAt') && (
                <th scope="col" className="px-6 py-4">
                  Fecha de Creación
                </th>
              )}
              {isVisible('sync') && (
                <th scope="col" className="px-6 py-4">
                  Sync
                </th>
              )}
              {isVisible('notes') && (
                <th scope="col" className="px-6 py-4">
                  Notas Justificación
                </th>
              )}
              <th scope="col" className="px-6 py-4 text-right">
                <div className="flex items-center justify-end">
                  <ColumnPicker
                    columns={configurableColumns}
                    isVisible={isVisible}
                    onToggle={toggleColumn}
                  />
                </div>
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
                    {isSupervisor && isVisible('advisor') && (
                      <td className="text-ink-2 px-6 py-4 text-xs font-semibold">
                        {advisors[deal.userId] || 'Cargando asesor...'}
                      </td>
                    )}
                    <td className="px-6 py-4 font-mono font-medium text-ink">
                      {formatGs(deal.amount)}
                    </td>
                    {isVisible('termMonths') && (
                      <td className="text-ink-2 px-6 py-4">
                        {deal.termMonths} meses
                      </td>
                    )}
                    {isVisible('interestRate') && (
                      <td className="text-ink-2 px-6 py-4">
                        {deal.interestRate}%
                      </td>
                    )}
                    {isVisible('stage') && (
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageConfig.style}`}
                        >
                          {stageConfig.label}
                        </span>
                      </td>
                    )}
                    {isVisible('createdAt') && (
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 font-mono text-xs text-ink-2">
                          <Calendar className="h-3 w-3 text-ink-3" />
                          {new Date(deal.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                    )}
                    {isVisible('sync') && (
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
                    )}
                    {isVisible('notes') && (
                      <td
                        className="max-w-xs truncate px-6 py-4 font-mono text-xs text-ink-2"
                        title={deal.notes}
                      >
                        {deal.notes || '-'}
                      </td>
                    )}
                    <td className="px-6 py-4" />
                  </tr>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={columnCount}
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
