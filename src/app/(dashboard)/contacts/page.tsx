'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb, LocalLead } from '@/lib/db'
import LeadFormModal from '@/components/LeadFormModal'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Cloud,
  Database,
  Filter
} from 'lucide-react'

export default function ContactsPage() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Estado del Modal de Edición/Creación de Lead
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<LocalLead | null>(null)

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState('')

  // 1. Obtener reactivamente todas las Empresas activas desde Dexie (para nombres y filtro)
  const companies = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.companies
        .filter((c) => c.deleted !== true)
        .toArray()
    },
    [userId],
    []
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
    []
  )

  // Soft Delete del Lead
  const handleDeleteLead = async (lead: LocalLead) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar a ${lead.firstName} ${lead.lastName}?`)) return
    try {
      const now = Date.now()
      if (lead.id) {
        // Tiene ID real: marcar soft delete para sincronizar con el servidor
        await localDb.leads.where('id').equals(lead.id).modify({
          deleted: true,
          synced: false,
          updatedAt: now,
        })
      } else if (lead.tempId) {
        // Creado offline y nunca sincronizado: borrar directamente del cliente
        await localDb.leads.where('tempId').equals(lead.tempId).delete()
      }
    } catch (err) {
      console.error('[Contacts] Error al eliminar lead:', err)
    }
  }

  // Filtrado de Leads
  const filteredLeads = leads.filter((lead) => {
    const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase()
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone && lead.phone.includes(searchTerm))

    const matchesCompany = filterCompanyId ? lead.companyId === filterCompanyId : true

    return matchesSearch && matchesCompany
  })

  // Obtener nombre de empresa por ID
  const getCompanyName = (compId?: string) => {
    if (!compId) return 'Ninguna'
    const comp = companies.find((c) => c.id === compId || c.tempId === compId)
    return comp ? comp.name : 'Cargando...'
  }

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <p className="text-sm font-medium animate-pulse">Cargando contactos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sección de Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-400" />
            Contactos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visualiza y administra tus leads almacenados localmente y sincronizados con el CRM.
          </p>
        </div>

        <button
          onClick={() => {
            setLeadToEdit(null)
            setIsLeadModalOpen(true)
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-700 transition-colors shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          Nuevo Contacto
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Buscador */}
          <div className="relative w-full sm:flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              placeholder="Buscar lead por nombre, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Filtro de Empresas */}
          <div className="relative w-full sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <select
              value={filterCompanyId}
              onChange={(e) => setFilterCompanyId(e.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
            >
              <option value="">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.id || c.tempId} value={c.id || c.tempId}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 text-[10px]">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Leads */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th scope="col" className="px-6 py-4">Nombre</th>
                <th scope="col" className="px-6 py-4">Email</th>
                <th scope="col" className="px-6 py-4">Teléfono</th>
                <th scope="col" className="px-6 py-4">Empresa</th>
                <th scope="col" className="px-6 py-4">Origen / Sinc</th>
                <th scope="col" className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-transparent">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr key={lead.id || lead.tempId} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{lead.email}</td>
                    <td className="px-6 py-4 text-slate-400">{lead.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {getCompanyName(lead.companyId)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {lead.synced ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                          <Cloud className="h-3.5 w-3.5" />
                          CloudDb
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20 animate-pulse">
                          <Database className="h-3.5 w-3.5" />
                          LocalDb
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setLeadToEdit(lead)
                            setIsLeadModalOpen(true)
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron leads registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario Modal para Leads */}
      <LeadFormModal
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false)
          setLeadToEdit(null)
        }}
        userId={userId}
        leadToEdit={leadToEdit}
      />
    </div>
  )
}
