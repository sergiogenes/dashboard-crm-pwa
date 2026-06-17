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
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
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
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          <Wallet className="h-8 w-8 text-indigo-400" />
          Solicitudes y Contratos (Deals)
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Monitor de solicitudes de microcréditos y estado del flujo de aprobación en el CRM.
        </p>
      </div>

      {/* Tarjetas de Métricas (Dashboard Superior) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Métrica 1: Total Solicitado */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Solicitado
            </span>
            <span className="mt-1 block text-xl font-bold text-white">
              $
              {totalApplied.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              {dealsLength} solicitudes totales
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-indigo-400">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 2: En Proceso de Aprobación */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              En Evaluación
            </span>
            <span className="mt-1 block text-xl font-bold text-indigo-400">
              $
              {totalActiveAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              {activeLoans.length} solicitudes activas
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-indigo-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 3: Desembolsado */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Desembolsado
            </span>
            <span className="mt-1 block text-xl font-bold text-emerald-400">
              $
              {totalDisbursedAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              {disbursedLoans.length} créditos vigentes
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Métrica 4: Mora / Alerta */}
        <div
          className={`flex items-center justify-between rounded-2xl border p-5 backdrop-blur-md transition-colors ${
            overdueCount > 0
              ? 'border-rose-500/20 bg-rose-500/5'
              : 'border-slate-800 bg-slate-900/10'
          }`}
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Créditos en Mora
            </span>
            <span
              className={`mt-1 block text-xl font-bold ${overdueCount > 0 ? 'text-rose-500' : 'text-white'}`}
            >
              {overdueCount}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-400">
              Requieren gestión urgente
            </span>
          </div>
          <div
            className={`rounded-xl border p-2.5 ${
              overdueCount > 0
                ? 'animate-pulse border-rose-500/20 bg-rose-500/10 text-rose-400'
                : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Buscador y Barra de Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* Buscador de Prestatario / Comentarios */}
          <div className="relative w-full sm:flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              placeholder="Buscar por prestatario o notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Filtro por Etapa */}
          <div className="relative w-full sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="block w-full cursor-pointer appearance-none rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-slate-500">
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
