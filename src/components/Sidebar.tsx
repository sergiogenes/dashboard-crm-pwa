'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  Building2,
  Wallet,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react'

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Contactos', href: '/contacts', icon: Users },
    { name: 'Empresas', href: '/companies', icon: Building2 },
    { name: 'Negocios', href: '/deals', icon: Wallet },
    { name: 'Configuración', href: '/settings', icon: Settings },
  ]

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      import('@/lib/db').then(({ localDb }) => {
        localDb.delete().catch((err) => console.error('Error al purgar IndexedDB:', err))
      })
      sessionStorage.removeItem('mfa_attempts')
      if (session?.user?.id) {
        localStorage.removeItem(`last_sync_time_${session.user.id}`)
      }
    }
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <aside
      className={`sticky top-0 left-0 z-20 flex h-screen flex-col border-r border-slate-800 bg-slate-950 text-slate-400 transition-all duration-300 shrink-0 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Cabecera del Sidebar */}
      <div className="relative flex h-16 items-center px-4 border-b border-slate-800/50">
        <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'mx-auto justify-center' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
            <Activity className="h-5 w-5 text-white animate-pulse" />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-bold tracking-wider text-white bg-gradient-to-r from-indigo-200 to-violet-200 bg-clip-text text-transparent truncate">
              CRM PWA
            </span>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3.5 top-[18px] z-30 h-7 w-7 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-all shadow-md"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Menú de Navegación */}
      <nav className={`flex-1 space-y-1.5 px-3 py-6 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all group relative ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/10'
                  : 'hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
              
              {/* Tooltip para cuando está colapsado */}
              {isCollapsed && (
                <div className="pointer-events-none absolute left-full ml-4 z-50 rounded bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-md">
                  {item.name}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Pie del Sidebar - Cerrar Sesión */}
      <div className="p-3 border-t border-slate-800/50">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-red-500/10 hover:text-red-400 transition-all group relative"
        >
          <LogOut className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-red-400 transition-transform group-hover:scale-105" />
          {!isCollapsed && <span className="truncate">Cerrar Sesión</span>}

          {isCollapsed && (
            <div className="pointer-events-none absolute left-full ml-4 z-50 rounded bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-red-400 opacity-0 transition-opacity group-hover:opacity-100 shadow-md">
              Cerrar Sesión
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}
