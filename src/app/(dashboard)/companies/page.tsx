'use client'

import React from 'react'
import { Building2, Plus, Search } from 'lucide-react'
import CompanyFormModal from '@/components/CompanyFormModal'
import CompanyTable from '@/components/companies/CompanyTable'
import CompanyCard from '@/components/companies/CompanyCard'
import { useCompanies } from '@/hooks/useCompanies'

export default function CompaniesPage() {
  const {
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
  } = useCompanies()

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-ink-2">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <p className="text-sm font-medium animate-pulse">Cargando empresas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sección de Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl flex items-center gap-3">
            <Building2 className="h-8 w-8 text-accent" />
            Empresas
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Visualiza y administra tus empresas guardadas localmente y sincronizadas con el CRM.
          </p>
        </div>

        <button
          onClick={() => {
            setCompanyToEdit(null)
            setIsCompanyModalOpen(true)
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-cta-bg px-4 py-2.5 text-sm font-semibold text-cta-ink shadow-lg hover:bg-accent transition-colors shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          Nueva Empresa
        </button>
      </div>

      {/* Buscador */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-3">
            <Building2 className="h-4.5 w-4.5 text-ink-3" /> {/* Replaced search icon or Building2 to match visual style */}
          </div>
          <input
            type="text"
            placeholder="Buscar empresa por nombre o nombre de dominio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-10 pr-4 text-xs text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <CompanyTable
        filteredCompanies={filteredCompanies}
        setCompanyToEdit={setCompanyToEdit}
        setIsCompanyModalOpen={setIsCompanyModalOpen}
        handleDeleteCompany={handleDeleteCompany}
      />

      <CompanyCard
        filteredCompanies={filteredCompanies}
        setCompanyToEdit={setCompanyToEdit}
        setIsCompanyModalOpen={setIsCompanyModalOpen}
        handleDeleteCompany={handleDeleteCompany}
      />

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
