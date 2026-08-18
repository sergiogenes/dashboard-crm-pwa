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
  Activity,
  ShieldAlert,
} from 'lucide-react'

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const baseMenuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Contactos', href: '/contacts', icon: Users },
    { name: 'Empresas', href: '/companies', icon: Building2 },
    { name: 'Negocios', href: '/deals', icon: Wallet },
    { name: 'Configuración', href: '/settings', icon: Settings },
  ]

  const menuItems = [...baseMenuItems]
  if (session?.user?.roles?.includes('admin')) {
    menuItems.push({ name: 'Admin', href: '/admin', icon: ShieldAlert })
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      import('@/lib/db').then(({ localDb }) => {
        localDb
          .delete()
          .catch((err) => console.error('Error al purgar IndexedDB:', err))
      })
      sessionStorage.removeItem('mfa_attempts')
      if (session?.user?.id) {
        localStorage.removeItem(`last_sync_time_${session.user.id}`)
      }
    }
    signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <>
      <aside
        className={`sticky left-0 top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-border bg-surface text-ink-2 transition-all duration-300 md:flex ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Cabecera del Sidebar */}
        <div className="relative flex h-16 items-center border-b border-border-2 px-4">
          <div
            className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'mx-auto justify-center' : ''}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cta-bg shadow-md">
              <Activity className="h-5 w-5 animate-pulse text-cta-ink" />
            </div>
            {!isCollapsed && (
              <span className="truncate text-sm font-bold tracking-wider text-ink">
                CRM PWA
              </span>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3.5 top-[18px] z-30 hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-ink-2 shadow-md transition-all hover:text-ink md:flex"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Menú de Navegación */}
        <nav
          className={`flex-1 space-y-1.5 px-3 py-6 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}
        >
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-cta-bg text-cta-ink shadow-lg'
                    : 'hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-cta-ink' : 'text-ink-3 group-hover:text-ink-2'}`}
                />
                {!isCollapsed && <span className="truncate">{item.name}</span>}

                {/* Tooltip para cuando está colapsado */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full z-50 ml-4 rounded border border-border bg-surface px-2 py-1 text-xs text-ink opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                    {item.name}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Pie del Sidebar - Cerrar Sesión */}
        <div className="border-t border-border-2 p-3">
          <button
            onClick={handleLogout}
            className="group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:bg-bad-bg hover:text-bad"
          >
            <LogOut className="h-5 w-5 shrink-0 text-ink-3 transition-transform group-hover:scale-105 group-hover:text-bad" />
            {!isCollapsed && <span className="truncate">Cerrar Sesión</span>}

            {isCollapsed && (
              <div className="pointer-events-none absolute left-full z-50 ml-4 rounded border border-border bg-surface px-2 py-1 text-xs text-bad opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                Cerrar Sesión
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Barra de navegación inferior para dispositivos móviles */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface/90 px-2 text-ink-2 backdrop-blur-md md:hidden">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex w-14 flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                isActive ? 'text-primary' : 'hover:text-ink'
              }`}
            >
              <Icon
                className={`h-5.5 w-5.5 ${isActive ? 'text-primary' : 'text-ink-3'}`}
              />
              <span className="max-w-full truncate text-[9px] font-medium tracking-wide">
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
