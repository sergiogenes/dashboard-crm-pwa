'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Cloud, Database, FileText, Edit2, Trash2, Settings } from 'lucide-react'
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

// Columnas configurables (#11): "Nombre" y "Acciones" quedan fijas (son
// estructurales -- identidad de la fila y sus acciones), todo lo demás lo
// elige el propio vendedor desde el selector. defaultOn decide qué se ve la
// primera vez que alguien abre la tabla, antes de guardar ninguna
// preferencia propia.
const CONFIGURABLE_COLUMNS = [
  { key: 'email', label: 'Email', defaultOn: true },
  { key: 'phone', label: 'Teléfono', defaultOn: true },
  { key: 'company', label: 'Empresa', defaultOn: false },
  { key: 'scoring', label: 'Scoring', defaultOn: true },
  { key: 'status', label: 'Estado', defaultOn: true },
  { key: 'sync', label: 'Origen / Sinc', defaultOn: false },
] as const

type ColumnKey = (typeof CONFIGURABLE_COLUMNS)[number]['key']

const VISIBLE_COLUMNS_STORAGE_KEY = 'contactsTable.visibleColumns.v2'

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
  // Default cuando todavía no hay preferencia guardada: en desarrollo
  // conviene ver "Origen / Sinc" para depurar; en producción no le aporta
  // nada al vendedor real. process.env.NODE_ENV lo resuelve Next.js en
  // build ('development' con next dev, 'production' con el build real).
  const isDev = process.env.NODE_ENV === 'development'
  const defaultVisible: ColumnKey[] = CONFIGURABLE_COLUMNS.filter(
    (col) => col.defaultOn || (col.key === 'sync' && isDev),
  ).map((col) => col.key)

  const [visible, setVisible] = useState<ColumnKey[]>(defaultVisible)
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Cargar preferencia guardada al montar -- si el usuario ya eligió algo
  // explícitamente, esa elección manda por sobre el default de entorno.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY)
      if (stored) setVisible(JSON.parse(stored))
    } catch {
      // Preferencia corrupta o inexistente: se queda en el default de arriba
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setColumnPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleColumn = (key: ColumnKey) => {
    const next = visible.includes(key)
      ? visible.filter((k) => k !== key)
      : [...visible, key]
    setVisible(next)
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(next))
  }

  const isVisible = (key: ColumnKey) => visible.includes(key)
  const columnCount = 2 + visible.length // Nombre + Acciones (fijas) + configurables activas

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-ink-2">
          <thead className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            <tr>
              <th scope="col" className="px-6 py-4">
                Nombre
              </th>
              {isVisible('email') && (
                <th scope="col" className="px-6 py-4">
                  Email
                </th>
              )}
              {isVisible('phone') && (
                <th scope="col" className="px-6 py-4">
                  Teléfono
                </th>
              )}
              {isVisible('company') && (
                <th scope="col" className="px-6 py-4">
                  Empresa
                </th>
              )}
              {isVisible('scoring') && (
                <th scope="col" className="px-6 py-4">
                  Scoring
                </th>
              )}
              {isVisible('status') && (
                <th scope="col" className="px-6 py-4">
                  Estado
                </th>
              )}
              {isVisible('sync') && (
                <th scope="col" className="px-6 py-4">
                  Origen / Sinc
                </th>
              )}
              <th scope="col" className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  Acciones
                  <div ref={pickerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setColumnPickerOpen((prev) => !prev)}
                      className="rounded-lg p-1 normal-case text-ink-3 transition-colors hover:bg-surface hover:text-ink"
                      title="Configurar columnas"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    {columnPickerOpen && (
                      <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-border bg-surface p-2 text-left shadow-2xl">
                        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-3">
                          Mostrar columnas
                        </p>
                        {CONFIGURABLE_COLUMNS.map((col) => (
                          <label
                            key={col.key}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-normal normal-case text-ink-2 transition-colors hover:bg-surface-2"
                          >
                            <input
                              type="checkbox"
                              checked={isVisible(col.key)}
                              onChange={() => toggleColumn(col.key)}
                              className="h-3.5 w-3.5 rounded border-border accent-primary"
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
                  {isVisible('email') && (
                    <td className="px-6 py-4 text-ink-2">{lead.email}</td>
                  )}
                  {isVisible('phone') && (
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
                  )}
                  {isVisible('company') && (
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                        {getCompanyName(lead.companyId)}
                      </span>
                    </td>
                  )}
                  {isVisible('scoring') && (
                    <td className="px-6 py-4">
                      {getScoringBadge(lead.scoring)}
                    </td>
                  )}
                  {isVisible('status') && (
                    <td className="px-6 py-4">{getLeadStatusBadge(lead)}</td>
                  )}
                  {isVisible('sync') && (
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
                  )}
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
                  colSpan={columnCount}
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
