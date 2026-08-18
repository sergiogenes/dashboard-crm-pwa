'use client'

import React from 'react'
import { Cloud, Database, FileText, Edit2, Trash2 } from 'lucide-react'
import { LocalLead } from '@/lib/db'

interface LeadTableProps {
  filteredLeads: LocalLead[]
  selectedLeadForInvoice: LocalLead | null
  setSelectedLeadForInvoice: (lead: LocalLead | null) => void
  userId: string | undefined
  getWhatsAppWindowStatus: (lead: LocalLead) => { active: boolean; text: string } | null
  getScoringBadge: (scoring: string | undefined) => React.ReactNode
  getLeadStatusBadge: (lead: LocalLead) => React.ReactNode
  getCompanyName: (companyId: string | undefined) => string
  setLeadToEdit: (lead: LocalLead | null) => void
  setIsLeadModalOpen: (open: boolean) => void
  handleDeleteLead: (lead: LocalLead) => void
}

export default function LeadTable({
  filteredLeads,
  selectedLeadForInvoice,
  setSelectedLeadForInvoice,
  userId,
  getWhatsAppWindowStatus,
  getScoringBadge,
  getLeadStatusBadge,
  getCompanyName,
  setLeadToEdit,
  setIsLeadModalOpen,
  handleDeleteLead,
}: LeadTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-ink-2">
          <thead className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            <tr>
              <th scope="col" className="px-6 py-4">
                Nombre
              </th>
              <th scope="col" className="px-6 py-4">
                Email
              </th>
              <th scope="col" className="px-6 py-4">
                Teléfono
              </th>
              <th scope="col" className="px-6 py-4">
                Empresa
              </th>
              <th scope="col" className="px-6 py-4">
                Scoring
              </th>
              <th scope="col" className="px-6 py-4">
                Estado
              </th>
              <th scope="col" className="px-6 py-4">
                Origen / Sinc
              </th>
              <th scope="col" className="px-6 py-4 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-2 bg-transparent">
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
                <tr
                  key={lead.id || lead.tempId}
                  className={`cursor-pointer transition-colors hover:bg-surface-2 ${
                    selectedLeadForInvoice?.id === lead.id ||
                    selectedLeadForInvoice?.tempId === lead.tempId
                      ? 'border-l-2 border-primary bg-surface-2'
                      : ''
                  }`}
                  onClick={() => setSelectedLeadForInvoice(lead)}
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-ink">
                      {lead.firstName} {lead.lastName}
                    </div>
                    {lead.documentId && (
                      <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                        ID: {lead.documentId}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ink-2">{lead.email}</td>
                  <td className="px-6 py-4 text-ink-2">
                    <div>{lead.phone || '-'}</div>
                    {(() => {
                      const status = getWhatsAppWindowStatus(lead)
                      if (!status) return null
                      return (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            status.active
                              ? 'bg-ok animate-pulse'
                              : 'bg-ink-3'
                          }`} />
                          <span className={`text-[10px] font-semibold tracking-wide ${
                            status.active
                              ? 'text-ok'
                              : 'text-ink-3'
                          }`}>
                            WA: {status.text}
                          </span>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                      {getCompanyName(lead.companyId)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getScoringBadge(lead.scoring)}
                  </td>
                  <td className="px-6 py-4">{getLeadStatusBadge(lead)}</td>
                  <td
                    className="px-6 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.synced ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-bd bg-ok-bg px-2.5 py-0.5 text-xs font-medium text-ok">
                        <Cloud className="h-3.5 w-3.5" />
                        CloudDb
                      </span>
                    ) : (
                      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-warn-bd bg-warn-bg px-2.5 py-0.5 text-xs font-medium text-warn">
                        <Database className="h-3.5 w-3.5" />
                        LocalDb
                      </span>
                    )}
                  </td>
                  <td
                    className="px-6 py-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedLeadForInvoice(lead)}
                        className="rounded-lg p-1.5 text-ink-2 transition-colors hover:bg-surface-2 hover:text-primary"
                        title="Ver Historial Crediticio"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setLeadToEdit(lead)
                          setIsLeadModalOpen(true)
                        }}
                        disabled={lead.userId !== userId}
                        className={`rounded-lg p-1.5 transition-colors ${
                          lead.userId !== userId
                            ? 'text-ink-3 cursor-not-allowed opacity-40'
                            : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                        }`}
                        title={
                          lead.userId !== userId
                            ? 'Solo Lectura (Propietario ajeno)'
                            : 'Editar'
                        }
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead)}
                        disabled={lead.userId !== userId}
                        className={`rounded-lg p-1.5 transition-colors ${
                          lead.userId !== userId
                            ? 'text-ink-3 cursor-not-allowed opacity-40'
                            : 'text-ink-2 hover:bg-bad-bg hover:text-bad'
                        }`}
                        title={
                          lead.userId !== userId
                            ? 'Solo Lectura (Propietario ajeno)'
                            : 'Eliminar'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-ink-3"
                >
                  No se encontraron leads registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
