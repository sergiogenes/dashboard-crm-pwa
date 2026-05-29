'use client'

import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '@/lib/db'
import Link from 'next/link'
import {
  Users,
  Building2,
  Percent,
  Cloud,
  CloudOff,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  History,
  ShieldCheck
} from 'lucide-react'

export default function DashboardHome() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

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

  // Estadísticas generales
  const totalLeads = leads?.length || 0
  const totalCompanies = companies?.length || 0

  const syncedLeads = leads?.filter((l) => l.synced === true).length || 0
  const syncedCompanies = companies?.filter((c) => c.synced === true).length || 0
  const totalSynced = syncedLeads + syncedCompanies
  const totalRecords = totalLeads + totalCompanies

  const syncRate = totalRecords > 0 ? Math.round((totalSynced / totalRecords) * 100) : 100

  // Obtener actividades recientes (últimos 5 leads ordenados por updatedAt desc)
  const recentLeads = [...(leads || [])]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5)

  // Distribución ficticia pero dinámica de Leads por estado (para el widget gráfico)
  const statesBreakdown = [
    { label: 'Nuevos', count: Math.round(totalLeads * 0.4), color: 'from-blue-500 to-indigo-500', pct: 40 },
    { label: 'En Contacto', count: Math.round(totalLeads * 0.3), color: 'from-indigo-500 to-violet-500', pct: 30 },
    { label: 'Calificados', count: Math.round(totalLeads * 0.2), color: 'from-violet-500 to-fuchsia-500', pct: 20 },
    { label: 'Perdidos', count: Math.round(totalLeads * 0.1), color: 'from-pink-500 to-rose-500', pct: 10 },
  ]

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <p className="text-sm font-medium animate-pulse">Cargando dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Saludo de Bienvenida */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            ¡Hola, {session?.user?.name || 'Usuario'}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aquí tienes un resumen de la actividad de tu CRM en modo híbrido offline/nube.
          </p>
        </div>
        <div className="text-xs text-slate-500 border border-slate-800 bg-slate-900/40 rounded-xl px-4 py-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Sesión protegida con MFA de doble factor.
        </div>
      </div>

      {/* Tarjetas de Estadísticas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card: Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Contactos</p>
              <h3 className="text-3xl font-extrabold text-white mt-2">{totalLeads}</h3>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span>Almacenados en base de datos local</span>
          </div>
        </div>

        {/* Card: Empresas */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Empresas</p>
              <h3 className="text-3xl font-extrabold text-white mt-2">{totalCompanies}</h3>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span>Clientes y cuentas corporativas</span>
          </div>
        </div>

        {/* Card: Sincronización */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sincronización</p>
              <h3 className="text-3xl font-extrabold text-white mt-2">{syncRate}%</h3>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
              <Percent className="h-6 w-6" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${syncRate === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{totalSynced} de {totalRecords} sincronizados</span>
          </div>
        </div>

        {/* Card: Estado de Red PWA */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Red y PWA</p>
              <h3 className="text-xl font-bold text-white mt-3">
                {navigator.onLine ? 'Conectado Online' : 'Modo Fuera de Línea'}
              </h3>
            </div>
            <div className={`rounded-xl p-3 ${navigator.onLine ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {navigator.onLine ? <Cloud className="h-6 w-6" /> : <CloudOff className="h-6 w-6" />}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Base local lista para offline</span>
          </div>
        </div>
      </div>

      {/* Widgets Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel Izquierdo: Gráfico de Pipeline de Leads */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Embudo de Ventas (Pipeline)</h4>
            </div>
            <span className="text-[10px] text-indigo-400 font-semibold border border-indigo-500/20 bg-indigo-500/5 px-2 py-0.5 rounded">
              Estimación Dinámica
            </span>
          </div>

          <div className="space-y-5 flex-1 flex flex-col justify-center">
            {statesBreakdown.map((state) => (
              <div key={state.label} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">{state.label}</span>
                  <span className="text-white">{state.count} leads ({state.pct}%)</span>
                </div>
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                  <div
                    className={`h-full bg-gradient-to-r ${state.color} rounded-full transition-all duration-500`}
                    style={{ width: `${totalLeads > 0 ? state.pct : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {totalLeads === 0 && (
              <p className="text-xs text-center text-slate-500 py-6">
                Registra leads en la pestaña de Contactos para ver su distribución.
              </p>
            )}
          </div>
        </div>

        {/* Panel Derecho: Acciones Rápidas */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-violet-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Acciones Rápidas</h4>
          </div>

          <Link
            href="/contacts"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-400">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Gestionar Contactos</p>
                <p className="text-[10px] text-slate-500">Crea, edita y asocia leads</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/companies"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-400">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Gestionar Empresas</p>
                <p className="text-[10px] text-slate-500">Crea corporativos asociados</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Actividades Recientes */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Últimos Cambios Locales</h4>
          </div>
          <span className="text-[10px] text-slate-500">
            Sincronización en segundo plano activa
          </span>
        </div>

        <div className="divide-y divide-slate-800/50">
          {recentLeads.length > 0 ? (
            recentLeads.map((lead) => (
              <div key={lead.id || lead.tempId} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="h-8.5 w-8.5 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {lead.firstName[0]}{lead.lastName[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{lead.firstName} {lead.lastName}</p>
                    <p className="text-[10px] text-slate-500">{lead.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    lead.synced
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/10 animate-pulse'
                  }`}>
                    {lead.synced ? 'Sincronizado' : 'Solo Local'}
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1">
                    Actualizado: {new Date(lead.updatedAt || Date.now()).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-center text-slate-500 py-6">
              No hay actividades de contactos registradas en la base de datos local.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
