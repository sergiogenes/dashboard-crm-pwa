'use client'

import { useSession, signOut } from 'next-auth/react'
import SyncStatusBadge from './SyncStatusBadge'
import { LogOut, Activity, User } from 'lucide-react'

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand/Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 shadow shadow-indigo-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            CRM Resiliente
          </span>
          <span className="hidden sm:inline rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            PWA
          </span>
        </div>

        {/* Acciones y Estado */}
        <div className="flex items-center gap-4">
          <SyncStatusBadge userId={session?.user?.id} />

          {session?.user && (
            <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200">
                    {session.user.name || 'Usuario'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {session.user.email}
                  </span>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                title="Cerrar Sesión"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
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
