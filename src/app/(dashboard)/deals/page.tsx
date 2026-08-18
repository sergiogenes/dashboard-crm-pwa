'use client'

import React from 'react'
import {
  Wallet,
  Search,
  Filter,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import DealTable from '@/components/deals/DealTable'
import DealCard from '@/components/deals/DealCard'
import { useDeals } from '@/hooks/useDeals'

export default function DealsPage() {
  const {
    status,
    userId,
    session,
    searchTerm,
    setSearchTerm,
    filterStage,
    setFilterStage,
    advisors,
    filteredDeals,
    getBorrowerName,
    totalApplied,
    activeLoans,
    totalActiveAmount,
    disbursedLoans,
    totalDisbursedAmount,
    overdueCount,
    dealsLength,
  } = useDeals()

  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-ink-2">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="animate-pulse text-sm font-medium">
          Cargando solicitudes...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sección de Encabezado */}
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          <Wallet className="h-8 w-8 text-accent" />
          Solicitudes y Contratos (Deals)
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Monitor de solicitudes de microcréditos y estado del flujo de aprobación en el CRM.
        </p>
      </div>

      {/* Tarjetas de Métricas (Dashboard Superior) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Métrica 1: Total Solicitado */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-3">
              Total Solicitado
            </span>
            <span className="mt-1 block text-xl font-bold text-ink">
              $
              {totalApplied.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-ink-2">
              {dealsLength} solicitudes totales
            </span>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-2.5 text-accent">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 2: En Proceso de Aprobación */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-3">
              En Evaluación
            </span>
            <span className="mt-1 block text-xl font-bold text-info">
              $
              {totalActiveAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-ink-2">
              {activeLoans.length} solicitudes activas
            </span>
          </div>
          <div className="rounded-xl border border-chip-bd bg-chip p-2.5 text-chip-ink">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 3: Desembolsado */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-3">
              Desembolsado
            </span>
            <span className="mt-1 block text-xl font-bold text-ok">
              $
              {totalDisbursedAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-ink-2">
              {disbursedLoans.length} créditos vigentes
            </span>
          </div>
          <div className="rounded-xl border border-ok-bd bg-ok-bg p-2.5 text-ok">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 4: Mora / Alerta */}
        <div
          className={`flex items-center justify-between rounded-2xl border p-5 transition-colors ${
            overdueCount > 0
              ? 'border-bad-bd bg-bad-bg'
              : 'border-border bg-surface'
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-3">
              Créditos en Mora
            </span>
            <span
              className={`mt-1 block text-xl font-bold ${overdueCount > 0 ? 'text-bad' : 'text-ink'}`}
            >
              {overdueCount}
            </span>
            <span className="mt-0.5 block text-[10px] text-ink-2">
              Requieren gestión urgente
            </span>
          </div>
          <div
            className={`rounded-xl border p-2.5 ${
              overdueCount > 0
                ? 'animate-pulse border-bad-bd bg-bad-bg text-bad'
                : 'border-border bg-surface-2 text-ink-2'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Buscador y Barra de Filtros */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* Buscador de Prestatario / Comentarios */}
          <div className="relative w-full sm:flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-3">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              placeholder="Buscar por prestatario o notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-10 pr-4 text-xs text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filtro por Etapa */}
          <div className="relative w-full sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-3">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="block w-full cursor-pointer appearance-none rounded-xl border border-border bg-surface-2 py-2.5 pl-10 pr-10 text-xs text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Todas las etapas</option>
              <option value="draft">Borrador</option>
              <option value="under_evaluation">Evaluación de Riesgo</option>
              <option value="approved">Aprobado</option>
              <option value="disbursed">Desembolsado</option>
              <option value="completed">Completado / Pagado</option>
              <option value="refused">Rechazado</option>
              <option value="overdue">En Mora</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-ink-3">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Monitor - Tabla Desktop */}
      <DealTable
        filteredDeals={filteredDeals}
        session={session}
        advisors={advisors}
        getBorrowerName={getBorrowerName}
      />

      {/* Monitor - Vista Móvil (Tarjetas) */}
      <DealCard
        filteredDeals={filteredDeals}
        session={session}
        advisors={advisors}
        getBorrowerName={getBorrowerName}
      />
    </div>
  )
}
