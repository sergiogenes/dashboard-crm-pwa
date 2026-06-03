'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb, LocalCompany } from '@/lib/db'
import CompanyFormModal from '@/components/CompanyFormModal'
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Cloud,
  Database
} from 'lucide-react'

export default function CompaniesPage() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Estado del Modal de Edición/Creación de Empresa
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [companyToEdit, setCompanyToEdit] = useState<LocalCompany | null>(null)

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('')

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

  // Soft Delete de Empresa y desasociación de leads
  const handleDeleteCompany = async (company: LocalCompany) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar la empresa ${company.name}? Esto desasociará a sus contactos.`
      )
    )
      return
    try {
      const now = Date.now()

      if (company.id) {
        // Eliminar lógicamente (soft delete) para sincronizar con la nube
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
        // Borrar directamente del cliente si nunca se sincronizó
        await localDb.companies.where('tempId').equals(company.tempId).delete()
        await localDb.leads.where('companyId').equals(company.tempId).modify({
          companyId: undefined,
          synced: false,
          updatedAt: now,
        })
      }
    } catch (err) {
      console.error('[Companies] Error al eliminar empresa:', err)
    }
  }

  // Filtrado de Empresas
  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.domain &&
        company.domain.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <p className="text-sm font-medium animate-pulse">Cargando empresas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sección de Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-400" />
            Empresas
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visualiza y administra tus empresas guardadas localmente y sincronizadas con el CRM.
          </p>
        </div>

        <button
          onClick={() => {
            setCompanyToEdit(null)
            setIsCompanyModalOpen(true)
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-700 transition-colors shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          Nueva Empresa
        </button>
      </div>

      {/* Buscador */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="h-4.5 w-4.5" />
          </div>
          <input
            type="text"
            placeholder="Buscar empresa por nombre o nombre de dominio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Tabla de Empresas */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
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
                  <tr
                    key={company.id || company.tempId}
                    className="hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-white">
                      {company.name}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {company.domain || '-'}
                    </td>
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
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCompany(company)}
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
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron empresas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista móvil (Tarjetas) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredCompanies.length > 0 ? (
          filteredCompanies.map((company) => (
            <div 
              key={company.id || company.tempId}
              className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {company.name}
                  </h3>
                  {company.domain && (
                    <p className="text-xs text-slate-400 mt-0.5">{company.domain}</p>
                  )}
                </div>
                <div>
                  {company.synced ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                      <Cloud className="h-3 w-3" />
                      CloudDb
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20 animate-pulse">
                      <Database className="h-3 w-3" />
                      LocalDb
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button
                  onClick={() => {
                    setCompanyToEdit(company)
                    setIsCompanyModalOpen(true)
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Editar"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteCompany(company)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-xs text-slate-500 py-12">No se encontraron empresas.</p>
        )}
      </div>

      {/* Formulario Modal para Empresas */}
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
