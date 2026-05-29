'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, Search, User, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import SyncStatusBadge from './SyncStatusBadge'

export default function Header() {
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      import('@/lib/db').then(({ localDb }) => {
        localDb.delete().catch((err) => console.error('Error al purgar IndexedDB:', err))
      })
    }
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-slate-800/50 bg-slate-950/80 px-6 backdrop-blur-md">
      {/* Barra de Búsqueda Global */}
      <div className="relative w-64 md:w-80">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <Search className="h-4.5 w-4.5" />
        </div>
        <input
          type="text"
          placeholder="Buscar en el CRM..."
          className="block w-full rounded-xl border border-slate-800 bg-slate-900/40 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Panel de Usuario y Notificaciones */}
      <div className="flex items-center gap-4">
        {/* Insignia de Sincronización PWA en tiempo real */}
        <SyncStatusBadge userId={session?.user?.id} />

        {/* Notificaciones */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        </button>

        {/* Dropdown del Usuario */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-1.5 pr-3 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:block text-left text-xs font-semibold text-slate-300">
              <p className="truncate max-w-24">{session?.user?.name || 'Usuario'}</p>
            </div>
          </button>

          {/* Menú desplegable */}
          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-25"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 z-30 rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-xl">
                <div className="px-3 py-2 border-b border-slate-800/50 mb-1 text-[11px] text-slate-500 truncate">
                  {session?.user?.email}
                </div>
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
                >
                  <Settings className="h-4 w-4 text-slate-500" />
                  Configuración
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4 text-red-500/80" />
                  Cerrar Sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
