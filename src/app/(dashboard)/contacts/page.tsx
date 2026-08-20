'use client'

import React from 'react'
import { Users, Plus, Search, Filter, Loader2 } from 'lucide-react'
import LeadFormModal from '@/components/LeadFormModal'
import LeadDrawer from '@/components/contacts/LeadDrawer'
import LeadTable from '@/components/contacts/LeadTable'
import LeadCard from '@/components/contacts/LeadCard'
import { useContacts } from '@/hooks/useContacts'
import { LocalLead } from '@/lib/db'
import { getScoringBadge as getScoringBadgeConfig, getLeadStatusBadge as getLeadStatusBadgeConfig } from '@/lib/theme/status'

export default function ContactsPage() {
  const {
    status,
    userId,
    isLeadModalOpen,
    setIsLeadModalOpen,
    leadToEdit,
    setLeadToEdit,
    selectedLeadForInvoice,
    setSelectedLeadForInvoice,
    highlightedActivityId,
    setHighlightedActivityId,
    whatsappTemplates,
    nowTime,
    searchTerm,
    setSearchTerm,
    filterCompanyId,
    setFilterCompanyId,
    companies,
    filteredLeads,
    isSearchingGlobal,
    isLoadingForeign,
    handleDeleteLead,
    getCompanyName,
    getLeadStatus,
    getWhatsAppWindowStatus,
    getLastContactedAt,
    invoicesToShow,
    activitiesToShow,
    dealsToShow,
  } = useContacts()

  // Badges de color para el Scoring y el estado del embudo (helper centralizado)
  const getScoringBadge = (scoring?: string) => {
    const { label, style } = getScoringBadgeConfig(scoring, 'compact')
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style}`}>{label}</span>
  }

  const getLeadStatusBadge = (lead: LocalLead) => {
    const statusVal = getLeadStatus(lead)
    const { label, style } = getLeadStatusBadgeConfig(statusVal)
    const isAjeno = statusVal !== 'Aprobado' && statusVal !== 'En Proceso' && statusVal !== 'Rechazado' && statusVal !== 'Nuevo' && statusVal !== 'Cargando...'
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
        title={isAjeno ? 'Contacto de otro asesor, pulse para cargar estado' : undefined}
      >
        {label}
      </span>
    )
  }

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-ink-2">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="animate-pulse text-sm font-medium">
          Cargando contactos...
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen gap-6">
      {/* Contenedor Principal de la Lista de Contactos */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Sección de Encabezado */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              <Users className="h-8 w-8 text-accent" />
              Contactos
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              Visualiza y administra tus leads almacenados localmente y sincronizados con el CRM.
            </p>
          </div>

          <button
            onClick={() => {
              setLeadToEdit(null)
              setIsLeadModalOpen(true)
            }}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cta-bg px-4 py-2.5 text-sm font-semibold text-cta-ink shadow-lg transition-colors hover:bg-accent"
          >
            <Plus className="h-4.5 w-4.5" />
            Nuevo Contacto
          </button>
        </div>

        {/* Buscador y Filtros */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* Buscador */}
            <div className="relative w-full sm:flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-3">
                {isSearchingGlobal ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                ) : (
                  <Search className="h-4.5 w-4.5" />
                )}
              </div>
              <input
                type="text"
                placeholder="Buscar por DNI/Cédula (Búsqueda global) o nombre/email local..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-10 pr-4 text-xs text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Filtro de Empresas */}
            <div className="relative w-full sm:w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-3">
                <Filter className="h-4.5 w-4.5" />
              </div>
              <select
                value={filterCompanyId}
                onChange={(e) => setFilterCompanyId(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-border bg-surface-2 py-2.5 pl-10 pr-10 text-xs text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todas las empresas</option>
                {companies.map((c) => (
                  <option key={c.id || c.tempId} value={c.id || c.tempId}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-ink-3">
                ▼
              </div>
            </div>
          </div>
        </div>

        <LeadTable
          filteredLeads={filteredLeads}
          selectedLeadForInvoice={selectedLeadForInvoice}
          setSelectedLeadForInvoice={setSelectedLeadForInvoice}
          userId={userId}
          getWhatsAppWindowStatus={getWhatsAppWindowStatus}
          getScoringBadge={getScoringBadge}
          getLeadStatusBadge={getLeadStatusBadge}
          getCompanyName={getCompanyName}
          getLastContactedAt={getLastContactedAt}
          setLeadToEdit={setLeadToEdit}
          setIsLeadModalOpen={setIsLeadModalOpen}
          handleDeleteLead={handleDeleteLead}
        />

        <LeadCard
          filteredLeads={filteredLeads}
          selectedLeadForInvoice={selectedLeadForInvoice}
          setSelectedLeadForInvoice={setSelectedLeadForInvoice}
          userId={userId}
          getWhatsAppWindowStatus={getWhatsAppWindowStatus}
          getScoringBadge={getScoringBadge}
          getLeadStatusBadge={getLeadStatusBadge}
          getCompanyName={getCompanyName}
          getLastContactedAt={getLastContactedAt}
          setLeadToEdit={setLeadToEdit}
          setIsLeadModalOpen={setIsLeadModalOpen}
          handleDeleteLead={handleDeleteLead}
        />

        {/* Slide-over Drawer: Detalles del Contacto (Finanzas y Actividades) */}
        {selectedLeadForInvoice && (
          <LeadDrawer
            selectedLeadForInvoice={selectedLeadForInvoice}
            setSelectedLeadForInvoice={setSelectedLeadForInvoice}
            userId={userId}
            invoices={invoicesToShow}
            activities={activitiesToShow}
            deals={dealsToShow}
            nowTime={nowTime}
            getWhatsAppWindowStatus={getWhatsAppWindowStatus}
            whatsappTemplates={whatsappTemplates}
            isLoadingForeign={isLoadingForeign}
            highlightedActivityId={highlightedActivityId}
            setHighlightedActivityId={setHighlightedActivityId}
          />
        )}
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
