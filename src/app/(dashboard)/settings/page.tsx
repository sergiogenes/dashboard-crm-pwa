'use client'

import React from 'react'
import {
  Settings,
  User,
  Shield,
  CheckCircle,
  HelpCircle,
  HardDrive
} from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'

export default function SettingsPage() {
  const { status, userId, session, localStats, isMfaActive } = useSettings()

  // Carga inicial
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <p className="text-sm font-medium animate-pulse">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Sección de Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
          <Settings className="h-8 w-8 text-indigo-400" />
          Configuración
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Administra las configuraciones de tu cuenta, seguridad de acceso y sincronización de base de datos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Panel 1: Perfil de Usuario */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <User className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Perfil del Usuario</h4>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Nombre</span>
              <p className="text-sm font-medium text-white">{session?.user?.name || 'Usuario'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Correo Electrónico</span>
              <p className="text-sm font-mono text-slate-300">{session?.user?.email}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">ID de Usuario</span>
              <p className="text-xs font-mono text-slate-500 break-all">{userId}</p>
            </div>
          </div>
        </div>

        {/* Panel 2: Seguridad y Doble Factor */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <Shield className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Seguridad (2FA / MFA)</h4>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-4">
              {isMfaActive ? (
                <>
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">MFA de Doble Factor Activo</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Tu cuenta está completamente protegida. Cada inicio de sesión requiere un código temporal TOTP de tu dispositivo móvil.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">MFA Pendiente de Activación</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      La seguridad obligatoria requiere que configures un autenticador de doble factor antes de realizar operaciones sensibles.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Almacenamiento Local (PWA) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <HardDrive className="h-5 w-5 text-indigo-400" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Base de Datos Local (IndexedDB)</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="rounded-xl bg-slate-950 border border-slate-900 p-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Leads Registrados</span>
            <span className="text-2xl font-bold text-white mt-1 block">{localStats.leads}</span>
            <span className="text-[9px] text-slate-500 mt-2 block">Caché en tabla localDb.leads</span>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-900 p-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Empresas Registradas</span>
            <span className="text-2xl font-bold text-white mt-1 block">{localStats.companies}</span>
            <span className="text-[9px] text-slate-500 mt-2 block">Caché en tabla localDb.companies</span>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-900 p-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Estado de Sincronización</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400">Automatizada (Sync Activa)</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-2.5 block">Sincronización bidireccional</span>
          </div>
        </div>
      </div>
    </div>
  )
}
