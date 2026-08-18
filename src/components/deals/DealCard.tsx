'use client'

import React from 'react'
import { Cloud, Database, Inbox } from 'lucide-react'
import { LocalDeal } from '@/lib/db'
import { getDealStageConfig } from '@/lib/theme/status'

interface DealCardProps {
  filteredDeals: LocalDeal[]
  session: any
  advisors: Record<string, string>
  getBorrowerName: (leadId: string) => string
}

export default function DealCard({
  filteredDeals,
  session,
  advisors,
  getBorrowerName,
}: DealCardProps) {
  const isSupervisor = session?.user?.roles?.includes('supervisor')

  return (
    <div className="grid grid-cols-1 gap-4 md:hidden">
      {filteredDeals.length > 0 ? (
        filteredDeals.map((deal) => {
          const stageConfig = getDealStageConfig(deal.stage)
          return (
            <div
              key={deal.id || deal.tempId}
              className="space-y-3 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    {getBorrowerName(deal.leadId)}
                  </h3>
                  {isSupervisor && (
                    <span className="mt-0.5 block text-[10px] font-semibold text-primary">
                      Asesor: {advisors[deal.userId] || 'Cargando asesor...'}
                    </span>
                  )}
                  <span className="mt-0.5 block font-mono text-[10px] text-ink-3">
                    Registro: {new Date(deal.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${stageConfig.style}`}
                >
                  {stageConfig.label}
                </span>
              </div>

              <div className="border-border-2 grid grid-cols-3 gap-2 border-y py-2">
                <div>
                  <span className="text-ink-3 block text-[8px] uppercase">
                    Monto
                  </span>
                  <span className="mt-0.5 block font-mono text-xs font-bold text-ink">
                    ${deal.amount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-ink-3 block text-[8px] uppercase">
                    Plazo
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-ink-2">
                    {deal.termMonths} meses
                  </span>
                </div>
                <div>
                  <span className="text-ink-3 block text-[8px] uppercase">
                    Interés
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-ink-2">
                    {deal.interestRate}%
                  </span>
                </div>
              </div>

              {deal.notes && (
                <p className="rounded border border-border-2 bg-surface-2 p-2 font-mono text-[11px] leading-relaxed text-ink-2">
                  {deal.notes}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 text-[10px]">
                <span className="text-ink-3">
                  Estado de Sincronización
                </span>
                {deal.synced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-bd bg-ok-bg px-2 py-0.5 font-medium text-ok">
                    <Cloud className="h-3 w-3" />
                    Cloud
                  </span>
                ) : (
                  <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-warn-bd bg-warn-bg px-2 py-0.5 font-medium text-warn">
                    <Database className="h-3 w-3" />
                    Local
                  </span>
                )}
              </div>
            </div>
          )
        })
      ) : (
        <div className="text-ink-3 py-12 text-center">
          <Inbox className="mx-auto mb-2 h-8 w-8 text-ink-3" />
          <p className="text-xs">No se encontraron solicitudes.</p>
        </div>
      )}
    </div>
  )
}
