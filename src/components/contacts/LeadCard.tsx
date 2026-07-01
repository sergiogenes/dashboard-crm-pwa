'use client'

import React from 'react'
import { Cloud, Database, FileText, Edit2, Trash2 } from 'lucide-react'
import { LocalLead } from '@/lib/db'

interface LeadCardProps {
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

export default function LeadCard({
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
}: LeadCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:hidden">
      {filteredLeads.length > 0 ? (
        filteredLeads.map((lead) => (
          <div
            key={lead.id || lead.tempId}
            onClick={() => setSelectedLeadForInvoice(lead)}
            className={`cursor-pointer space-y-3 rounded-2xl border p-4 transition-all duration-300 ${
              selectedLeadForInvoice?.id === lead.id ||
              selectedLeadForInvoice?.tempId === lead.tempId
                ? 'border-indigo-500 bg-slate-900/40 shadow-md ring-1 ring-indigo-500/20'
                : 'border-slate-800 bg-slate-900/20'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lead.firstName} {lead.lastName}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {lead.email}
                </p>
                {lead.documentId && (
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    ID: {lead.documentId}
                  </p>
                )}
                {lead.phone && (
                  <div>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {lead.phone}
                    </p>
                    {(() => {
                      const status = getWhatsAppWindowStatus(lead)
                      if (!status) return null
                      return (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            status.active 
                              ? 'bg-emerald-500 animate-pulse' 
                              : 'bg-slate-600'
                          }`} />
                          <span className={`text-[10px] font-semibold tracking-wide ${
                            status.active 
                              ? 'text-emerald-400' 
                              : 'text-slate-500'
                          }`}>
                            WA: {status.text}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {lead.synced ? (
                  <span
                    className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 p-1 text-emerald-400"
                    title="CloudDb"
                  >
                    <Cloud className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span
                    className="inline-flex animate-pulse items-center rounded-full border border-amber-500/20 bg-amber-500/10 p-1 text-amber-400"
                    title="LocalDb"
                  >
                    <Database className="h-3.5 w-3.5" />
                  </span>
                )}
                {getScoringBadge(lead.scoring)}
              </div>
            </div>

            <div className="border-slate-850 flex items-center justify-between border-t pt-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded border border-slate-800/80 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-400">
                  {getCompanyName(lead.companyId)}
                </span>
                {getLeadStatusBadge(lead)}
              </div>

              <div
                className="flex gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedLeadForInvoice(lead)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-indigo-400"
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
                      ? 'text-slate-750 cursor-not-allowed opacity-40'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
                      ? 'text-slate-750 cursor-not-allowed opacity-40'
                      : 'text-slate-400 hover:bg-red-500/20 hover:text-red-400'
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
            </div>
          </div>
        ))
      ) : (
        <p className="py-12 text-center text-xs text-slate-500">
          No se encontraron contactos.
        </p>
      )}
    </div>
  )
}
