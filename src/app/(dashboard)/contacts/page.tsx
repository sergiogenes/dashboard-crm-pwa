'use client'

import React from 'react'
import { Users, Plus, Search, Filter, Loader2 } from 'lucide-react'
import LeadFormModal from '@/components/LeadFormModal'
import LeadDrawer from '@/components/contacts/LeadDrawer'
import LeadTable from '@/components/contacts/LeadTable'
import LeadCard from '@/components/contacts/LeadCard'
import { useContacts } from '@/hooks/useContacts'
import { LocalLead } from '@/lib/db'

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
    invoicesToShow,
    activitiesToShow,
    dealsToShow,
  } = useContacts()

  // Badges de color premium para el Scoring
  const getScoringBadge = (scoring?: string) => {
    if (!scoring)
      return <span className="text-xs font-semibold text-slate-500">-</span>

    const borderStyle = scoring.startsWith('A')
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
      : scoring.startsWith('B')
      ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400'
      : scoring.startsWith('C')
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
      : 'border-rose-500/20 bg-rose-500/10 text-rose-400 inline-flex animate-pulse'

    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${borderStyle}`}>
        {scoring}
      </span>
    )
  }

  // Badge del estado con colores de la paleta del dashboard
  const getLeadStatusBadge = (lead: LocalLead) => {
    const statusVal = getLeadStatus(lead)
    switch (statusVal) {
      case 'Aprobado':
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            Aprobado
          </span>
        )
      case 'En Proceso':
        return (
          <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            En Proceso
          </span>
        )
      case 'Rechazado':
        return (
          <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            Rechazado
          </span>
        )
      case 'Nuevo':
        return (
          <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
            Nuevo
          </span>
        )
      case 'Cargando...':
        return (
          <span className="inline-flex animate-pulse items-center rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            Cargando...
          </span>
        )
      default: // 'Ajeno'
        return (
          <span
            className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400"
            title="Contacto de otro asesor, pulse para cargar estado"
          >
            Ajeno
          </span>
        )
    }
  }

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
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
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              <Users className="h-8 w-8 text-indigo-400" />
              Contactos
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Visualiza y administra tus leads almacenados localmente y sincronizados con el CRM.
            </p>
          </div>

          <button
            onClick={() => {
              setLeadToEdit(null)
              setIsLeadModalOpen(true)
            }}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:from-indigo-600 hover:to-violet-700"
          >
            <Plus className="h-4.5 w-4.5" />
            Nuevo Contacto
          </button>
        </div>

        {/* Buscador y Filtros */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* Buscador */}
            <div className="relative w-full sm:flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                {isSearchingGlobal ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-500" />
                ) : (
                  <Search className="h-4.5 w-4.5" />
                )}
              </div>
              <input
                type="text"
                placeholder="Buscar por DNI/Cédula (Búsqueda global) o nombre/email local..."
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
                className="block w-full appearance-none rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Todas las empresas</option>
                {companies.map((c) => (
                  <option key={c.id || c.tempId} value={c.id || c.tempId}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-slate-500">
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
