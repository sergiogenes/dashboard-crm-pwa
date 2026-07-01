'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb, LocalCompany } from '@/lib/db'

export function useCompanies() {
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

  return {
    status,
    userId,
    isCompanyModalOpen,
    setIsCompanyModalOpen,
    companyToEdit,
    setCompanyToEdit,
    searchTerm,
    setSearchTerm,
    filteredCompanies,
    handleDeleteCompany,
  }
}
