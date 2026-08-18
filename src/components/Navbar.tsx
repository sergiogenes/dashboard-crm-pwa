'use client'

import { useSession, signOut } from 'next-auth/react'
import SyncStatusBadge from './SyncStatusBadge'
import { LogOut, Activity, User } from 'lucide-react'

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand/Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cta-bg shadow">
            <Activity className="h-5 w-5 text-cta-ink" />
          </div>
          <span className="text-lg font-bold tracking-tight text-ink">
            CRM Resiliente
          </span>
          <span className="hidden sm:inline rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-2">
            PWA
          </span>
        </div>

        {/* Acciones y Estado */}
        <div className="flex items-center gap-4">
          <SyncStatusBadge userId={session?.user?.id} />

          {session?.user && (
            <div className="flex items-center gap-4 border-l border-border pl-4">
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-ink-2 border border-border">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-ink">
                    {session.user.name || 'Usuario'}
                  </span>
                  <span className="text-[10px] text-ink-2">
                    {session.user.email}
                  </span>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                title="Cerrar Sesión"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
