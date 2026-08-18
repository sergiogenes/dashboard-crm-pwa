'use client'

import React from 'react'
import Link from 'next/link'
import SupervisorDashboard from '@/components/SupervisorDashboard'
import {
  Users,
  Building2,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  History,
  ShieldCheck,
} from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'

export default function DashboardHome() {
  const {
    status,
    userId,
    session,
    totalLeads,
    totalCompanies,
    totalSynced,
    totalRecords,
    syncRate,
    countNew,
    countInProcess,
    countApproved,
    countRejected,
    conversionRate,
    pctNew,
    pctInProcess,
    pctApproved,
    pctRejected,
    recentChanges,
  } = useDashboard()

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-ink-2">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="animate-pulse text-sm font-medium">
          Cargando dashboard...
        </p>
      </div>
    )
  }

  // Renderizar condicionalmente el panel del supervisor
  if (session?.user?.roles?.includes('supervisor')) {
    return <SupervisorDashboard />
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Saludo de Bienvenida */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            ¡Hola, {session?.user?.name || 'Usuario'}!
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Aquí tienes un resumen de la actividad de tu CRM en modo híbrido offline/nube.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Badge Red/PWA */}
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              typeof window !== 'undefined' && navigator.onLine
                ? 'border-ok-bd bg-ok-bg text-ok'
                : 'border-warn-bd bg-warn-bg text-warn'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                typeof window !== 'undefined' && navigator.onLine ? 'animate-pulse bg-ok' : 'bg-warn'
              }`}
            />
            <span>{typeof window !== 'undefined' && navigator.onLine ? 'Online' : 'Offline'}</span>
          </div>

          {/* Badge Sync Rate */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs text-ink-2">
            <span className="font-bold text-ink">{syncRate}%</span>
            <span>
              Sync ({totalSynced}/{totalRecords})
            </span>
          </div>

          {/* Badge MFA */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs text-ink-3">
            <ShieldCheck className="h-4 w-4 text-ok" />
            <span>MFA</span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Principales (KPIs) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total de Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Total Leads
          </p>
          <h3 className="mt-2 text-2xl font-bold text-ink">
            {totalLeads}
          </h3>
          <span className="mt-1 block text-[9px] text-ink-3">
            Base local activa
          </span>
        </div>

        {/* Nuevos Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Nuevos
          </p>
          <h3 className="mt-2 text-2xl font-bold text-info">
            {countNew}
          </h3>
          <span className="mt-1 block text-[9px] text-ink-3">
            Sin contactar
          </span>
        </div>

        {/* Leads en Proceso */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            En Proceso
          </p>
          <h3 className="mt-2 text-2xl font-bold text-warn">
            {countInProcess}
          </h3>
          <span className="mt-1 block text-[9px] text-ink-3">
            Bajo evaluación
          </span>
        </div>

        {/* Aprobados */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Aprobados
          </p>
          <h3 className="mt-2 text-2xl font-bold text-ok">
            {countApproved}
          </h3>
          <span className="mt-1 block text-[9px] text-ink-3">
            Créditos vigentes
          </span>
        </div>

        {/* Rechazados */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Rechazados
          </p>
          <h3 className="mt-2 text-2xl font-bold text-bad">
            {countRejected}
          </h3>
          <span className="mt-1 block text-[9px] text-ink-3">
            No calificados
          </span>
        </div>

        {/* Conversion Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Conversión
          </p>
          <h3 className="mt-2 text-2xl font-bold text-ink">
            {conversionRate}%
          </h3>
          <span className="mt-1 block text-[9px] text-ink-3">
            Aprobados / Total
          </span>
        </div>
      </div>

      {/* Widgets Principales */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Panel Izquierdo: Gráfico de Pipeline de Leads */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-ink">
                Embudo de Ventas (Pipeline)
              </h4>
            </div>
            <span className="rounded border border-chip-bd bg-chip px-2 py-0.5 text-[10px] font-semibold text-chip-ink">
              Datos Reales
            </span>
          </div>

          <div className="flex flex-col items-center justify-center space-y-3.5 py-4">
            {totalLeads === 0 ? (
              <p className="py-12 text-center text-xs text-ink-3">
                Registra leads en la pestaña de Contactos para inicializar el embudo.
              </p>
            ) : (
              <>
                {/* Nivel: Nuevos */}
                <div
                  className="stage-1 animate-in slide-in-from-top-4 relative flex w-full items-center justify-between overflow-hidden rounded-xl border px-5 py-3 shadow-md transition-all duration-300"
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-s1/10"
                    style={{ width: `${pctNew}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="stage-label block text-[10px] font-bold uppercase tracking-widest">
                      Nuevos (Sin Contactar)
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-ink">
                      {countNew} Leads
                    </span>
                  </div>
                  <span className="stage-pct z-10 rounded border border-s1-bd bg-surface px-2 py-0.5 text-xs font-black">
                    {pctNew}%
                  </span>
                </div>

                {/* Nivel: En Proceso */}
                <div
                  className="stage-2 animate-in slide-in-from-top-4 relative flex items-center justify-between overflow-hidden rounded-xl border px-5 py-3 shadow-md transition-all delay-75 duration-300"
                  style={{ width: '85%' }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-s2/10"
                    style={{ width: `${pctInProcess}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="stage-label block text-[10px] font-bold uppercase tracking-widest">
                      En Proceso / Evaluados
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-ink">
                      {countInProcess} Leads
                    </span>
                  </div>
                  <span className="stage-pct z-10 rounded border border-s2-bd bg-surface px-2 py-0.5 text-xs font-black">
                    {pctInProcess}%
                  </span>
                </div>

                {/* Nivel: Aprobados */}
                <div
                  className="stage-3 animate-in slide-in-from-top-4 relative flex items-center justify-between overflow-hidden rounded-xl border px-5 py-3 shadow-md transition-all delay-150 duration-300"
                  style={{ width: '70%' }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-s3/10"
                    style={{ width: `${pctApproved}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="stage-label block text-[10px] font-bold uppercase tracking-widest">
                      Aprobados / Cerrados
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-ink">
                      {countApproved} Leads
                    </span>
                  </div>
                  <span className="stage-pct z-10 rounded border border-s3-bd bg-surface px-2 py-0.5 text-xs font-black">
                    {pctApproved}%
                  </span>
                </div>

                {/* Nivel: Rechazados */}
                <div
                  className="stage-4 animate-in slide-in-from-top-4 relative flex items-center justify-between overflow-hidden rounded-xl border px-5 py-3 shadow-md transition-all delay-200 duration-300"
                  style={{ width: '55%' }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-s4/10"
                    style={{ width: `${pctRejected}%` }}
                  />
                  <div className="z-10 text-left">
                    <span className="stage-label block text-[10px] font-bold uppercase tracking-widest">
                      Rechazados / Perdidos
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-ink">
                      {countRejected} Leads
                    </span>
                  </div>
                  <span className="stage-pct z-10 rounded border border-s4-bd bg-surface px-2 py-0.5 text-xs font-black">
                    {pctRejected}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Panel Derecho: Acciones Rápidas */}
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-ink">
              Acciones Rápidas
            </h4>
          </div>

          <Link
            href="/contacts"
            className="group flex items-center justify-between rounded-xl border border-border bg-surface-2 p-4 transition-all hover:border-primary/30 hover:bg-surface"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-chip p-2.5 text-chip-ink">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-ink">
                  Gestionar Contactos
                </p>
                <p className="text-[10px] text-ink-3">
                  Crea, edita y asocia leads
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-3 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/companies"
            className="group flex items-center justify-between rounded-xl border border-border bg-surface-2 p-4 transition-all hover:border-primary/30 hover:bg-surface"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-chip p-2.5 text-chip-ink">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-ink">
                  Gestionar Empresas
                </p>
                <p className="text-[10px] text-ink-3">
                  Crea corporativos asociados
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-3 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Actividades Recientes */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-accent" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-ink">
              Últimos Cambios Locales
            </h4>
          </div>
          <span className="text-[10px] text-ink-3">
            Sincronización en segundo plano activa
          </span>
        </div>

        <div className="divide-y divide-border-2">
          {recentChanges.length > 0 ? (
            recentChanges.map((change) => {
              const isLead = change.entityType === 'lead'
              const href = isLead
                ? `/contacts?leadId=${change.id || change.tempId}`
                : `/companies`
              const name = isLead
                ? `${change.firstName} ${change.lastName}`
                : change.name
              const subtitle = isLead
                ? change.email
                : change.domain || 'Empresa'
              const initials = isLead
                ? `${change.firstName?.[0] || ''}${change.lastName?.[0] || ''}`.toUpperCase()
                : (change.name?.[0] || 'E').toUpperCase()

              return (
                <Link
                  key={change.id || change.tempId}
                  href={href}
                  className="group -mx-3 flex cursor-pointer items-center justify-between rounded-xl px-3 py-3.5 transition-all first:pt-0 last:pb-0 hover:bg-surface-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8.5 w-8.5 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isLead
                          ? 'bg-chip text-chip-ink'
                          : 'bg-surface-2 border border-border text-accent'
                      }`}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-ink transition-colors group-hover:text-primary">
                          {name}
                        </p>
                        <span
                          className={`py-0.2 inline-flex items-center rounded-md border px-1.5 text-[8px] font-semibold ${
                            isLead
                              ? 'border-chip-bd bg-chip text-chip-ink'
                              : 'border-border bg-surface-2 text-accent'
                          }`}
                        >
                          {isLead ? 'Contacto' : 'Empresa'}
                        </span>
                      </div>
                      <p className="text-[10px] text-ink-3">{subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        change.synced
                          ? 'border border-ok-bd bg-ok-bg text-ok'
                          : 'animate-pulse border border-warn-bd bg-warn-bg text-warn'
                      }`}
                    >
                      {change.synced ? 'Sincronizado' : 'Solo Local'}
                    </span>
                    <p className="mt-1 text-[9px] text-ink-3">
                      Actualizado:{' '}
                      {new Date(
                        change.updatedAt || Date.now(),
                      ).toLocaleTimeString()}
                    </p>
                  </div>
                </Link>
              )
            })
          ) : (
            <p className="py-6 text-center text-xs text-ink-3">
              No hay cambios locales recientes registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
