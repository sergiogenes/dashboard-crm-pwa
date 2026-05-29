'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb, LocalLead, LocalCompany } from '@/lib/db'
import Navbar from '@/components/Navbar'
import LeadFormModal from '@/components/LeadFormModal'
import CompanyFormModal from '@/components/CompanyFormModal'
import {
  Users,
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Cloud,
  CloudOff,
  Percent,
  CheckCircle,
  Database,
  ArrowUpRight,
  Filter
} from 'lucide-react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Estado de los Modales
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false)
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<LocalLead | null>(null)
  const [companyToEdit, setCompanyToEdit] = useState<LocalCompany | null>(null)

  // Filtros y Vista activa (Tabs)
  const [activeTab, setActiveTab] = useState<'leads' | 'companies'>('leads')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState('')

  // 1. Obtener reactivamente todas las Empresas activas desde Dexie
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

  // 3. Estadísticas generales
  const totalLeads = leads?.length || 0
  const totalCompanies = companies?.length || 0

  const syncedLeads = leads?.filter((l) => l.synced === true).length || 0
  const syncedCompanies = companies?.filter((c) => c.synced === true).length || 0
  const totalSynced = syncedLeads + syncedCompanies
  const totalRecords = totalLeads + totalCompanies

  const syncRate = totalRecords > 0 ? Math.round((totalSynced / totalRecords) * 100) : 100

  // 4. Soft Delete (Eliminación lógica local que se sincronizará con el servidor)
  const handleDeleteLead = async (lead: LocalLead) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar a ${lead.firstName} ${lead.lastName}?`)) return
    try {
      const now = Date.now()
      if (lead.id) {
        // Tiene ID real: marcar soft delete para sincronizar
        await localDb.leads.where('id').equals(lead.id).modify({
          deleted: true,
          synced: false,
          updatedAt: now,
        })
      } else if (lead.tempId) {
        // Creado offline y nunca sincronizado: borrar directamente
        await localDb.leads.where('tempId').equals(lead.tempId).delete()
      }
    } catch (err) {
      console.error('[Dashboard] Error al eliminar lead:', err)
    }
  }

  const handleDeleteCompany = async (company: LocalCompany) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la empresa ${company.name}? Esto desasociará a sus contactos.`)) return
    try {
      const now = Date.now()
      
      // Eliminar o desasociar la empresa
      if (company.id) {
        await localDb.companies.where('id').equals(company.id).modify({
          deleted: true,
          synced: false,
          updatedAt: now,
        })
        // Desasociar leads asociados a esta empresa
        await localDb.leads.where('companyId').equals(company.id).modify({
          companyId: undefined,
          synced: false,
          updatedAt: now,
        })
      } else if (company.tempId) {
        await localDb.companies.where('tempId').equals(company.tempId).delete()
        await localDb.leads.where('companyId').equals(company.tempId).modify({
          companyId: undefined,
          synced: false,
          updatedAt: now,
        })
      }
    } catch (err) {
      console.error('[Dashboard] Error al eliminar empresa:', err)
    }
  }

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <p className="text-sm font-medium animate-pulse">Cargando base de datos local y sesión...</p>
      </div>
    )
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

  // Filtrado de Empresas
  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.domain && company.domain.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  // Obtener nombre de empresa por ID
  const getCompanyName = (compId?: string) => {
    if (!compId) return 'Ninguna'
    const comp = companies.find((c) => c.id === compId || c.tempId === compId)
    return comp ? comp.name : 'Cargando...'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Sección de Encabezado */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Panel de Control
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona tus leads y empresas con persistencia local y sincronización automática.
          </p>
        </div>

        {/* Tarjetas de Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Card: Leads */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Leads</p>
                <h3 className="text-3xl font-extrabold text-white mt-2">{totalLeads}</h3>
              </div>
              <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
              <Database className="h-4 w-4 text-slate-500" />
              <span>Guardados en localDb</span>
            </div>
          </div>

          {/* Card: Empresas */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Empresas</p>
                <h3 className="text-3xl font-extrabold text-white mt-2">{totalCompanies}</h3>
              </div>
              <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
                <Building2 className="h-6 w-6" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
              <ArrowUpRight className="h-4 w-4 text-slate-500" />
              <span>CRM Integrado</span>
            </div>
          </div>

          {/* Card: Tasa Sincronización */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sincronización</p>
                <h3 className="text-3xl font-extrabold text-white mt-2">{syncRate}%</h3>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                <Percent className="h-6 w-6" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>{totalSynced} de {totalRecords} en la nube</span>
            </div>
          </div>

          {/* Card: Estado General */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Estado PWA</p>
                <h3 className="text-xl font-bold text-white mt-3">
                  {navigator.onLine ? 'Operativo Online' : 'Modo Fuera de Línea'}
                </h3>
              </div>
              <div className={`rounded-xl p-3 ${navigator.onLine ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {navigator.onLine ? <Cloud className="h-6 w-6" /> : <CloudOff className="h-6 w-6" />}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Resiliencia Offline Activada</span>
            </div>
          </div>
        </div>

        {/* Buscador, Filtros y Pestañas */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-3 self-start">
              <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                <button
                  onClick={() => {
                    setActiveTab('leads')
                    setSearchTerm('')
                  }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    activeTab === 'leads' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Leads / Contactos
                </button>
                <button
                  onClick={() => {
                    setActiveTab('companies')
                    setSearchTerm('')
                  }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    activeTab === 'companies' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Empresas
                </button>
              </div>

              {/* Botón Contextual */}
              {activeTab === 'leads' ? (
                <button
                  onClick={() => {
                    setLeadToEdit(null)
                    setIsLeadModalOpen(true)
                  }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-700 transition-colors shrink-0"
                >
                  <Plus className="h-4.5 w-4.5" />
                  Contacto
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCompanyToEdit(null)
                    setIsCompanyModalOpen(true)
                  }}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors shrink-0"
                >
                  <Plus className="h-4.5 w-4.5" />
                  Empresa
                </button>
              )}
            </div>

            {/* Inputs de Búsqueda y Filtro */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-72">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Search className="h-4.5 w-4.5" />
                </div>
                <input
                  type="text"
                  placeholder={activeTab === 'leads' ? 'Buscar lead por nombre, email...' : 'Buscar empresa por nombre, dominio...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {activeTab === 'leads' && (
                <div className="relative w-full sm:w-56">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Filter className="h-4.5 w-4.5" />
                  </div>
                  <select
                    value={filterCompanyId}
                    onChange={(e) => setFilterCompanyId(e.target.value)}
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
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
              )}
            </div>
          </div>
        </div>

        {/* Listado de Leads */}
        {activeTab === 'leads' && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-300">
                <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                          <span className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs text-slate-300">
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
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
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
        )}

        {/* Listado de Empresas */}
        {activeTab === 'companies' && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-300">
                <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-6 py-4">Nombre</th>
                    <th scope="col" className="px-6 py-4">Dominio</th>
                    <th scope="col" className="px-6 py-4">Origen / Sinc</th>
                    <th scope="col" className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-transparent">
                  {filteredCompanies.length > 0 ? (
                    filteredCompanies.map((company) => (
                      <tr key={company.id || company.tempId} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">
                          {company.name}
                        </td>
                        <td className="px-6 py-4 text-slate-400">{company.domain || '-'}</td>
                        <td className="px-6 py-4">
                          {company.synced ? (
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
                                setCompanyToEdit(company)
                                setIsCompanyModalOpen(true)
                              }}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCompany(company)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
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
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No se encontraron empresas registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Formularios Modales */}
      <LeadFormModal
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false)
          setLeadToEdit(null)
        }}
        userId={userId}
        leadToEdit={leadToEdit}
      />

      <CompanyFormModal
        isOpen={isCompanyModalOpen}
        onClose={() => {
          setIsCompanyModalOpen(false)
          setCompanyToEdit(null)
        }}
        userId={userId}
        companyToEdit={companyToEdit}
      />
    </div>
  )
}
