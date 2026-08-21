'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, User, LogOut, Settings, CheckSquare } from 'lucide-react'
import Link from 'next/link'
import SyncStatusBadge from './SyncStatusBadge'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '@/lib/db'
import { useRouter } from 'next/navigation'

export default function Header() {
  const { data: session } = useSession()
  const router = useRouter()
  const userId = session?.user?.id || ''
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false)
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Consulta reactiva de notificaciones de recordatorios vencidos
  const notifications = useLiveQuery(
    async () => {
      if (!userId) return []
      const now = Date.now()
      const allNotifs = await localDb.notifications
        .where('userId')
        .equals(userId)
        .toArray()

      return allNotifs
        .filter((n) => n.scheduledAt <= now)
        .sort((a, b) => b.scheduledAt - a.scheduledAt)
    },
    [userId]
  )

  const unreadCount = notifications ? notifications.filter((n) => !n.read).length : 0

  const markActivityReminderAsRead = async (activityId?: string) => {
    if (!activityId) return
    try {
      const act =
        (await localDb.activities.where('tempId').equals(activityId).first()) ||
        (await localDb.activities.where('id').equals(activityId).first())
      if (act && act.tempId && !act.reminderRead) {
        await localDb.activities.update(act.tempId, {
          reminderRead: true,
          reminderStatus: 'waiting',
          synced: false,
          updatedAt: Date.now(),
        })
      }
    } catch (err) {
      console.error('[Header] Error al marcar recordatorio como leído en actividad:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!notifications) return
    const unread = notifications.filter((n) => !n.read)
    for (const notif of unread) {
      await localDb.notifications.update(notif.id, { read: true })
      await markActivityReminderAsRead(notif.activityId)
    }
  }

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
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-end border-b border-border-2 bg-surface/80 px-6 backdrop-blur-md">

      {/* Panel de Usuario y Notificaciones */}
      <div className="flex items-center gap-4">
        {/* Insignia de Sincronización PWA en tiempo real */}
        <SyncStatusBadge userId={session?.user?.id} />

        {/* Notificaciones */}
        <div className="relative" ref={notifRef}>
          {unreadCount > 0 ? (
            <button
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen)
                setDropdownOpen(false)
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-bad-bd bg-bad-bg text-bad hover:bg-bad-bg/70 transition-colors"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-badge text-[10px] font-bold text-white ring-2 ring-surface">
                {unreadCount}
              </span>
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 animate-ping rounded-full bg-badge opacity-75" />
            </button>
          ) : (
            <button
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen)
                setDropdownOpen(false)
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2 text-ink-3 hover:text-ink-2 hover:bg-border-2 transition-colors"
            >
              <Bell className="h-5 w-5" />
            </button>
          )}

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 z-30 rounded-xl border border-border bg-surface p-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border-2 mb-2">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">Recordatorios</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-primary hover:text-accent font-semibold"
                    >
                      Marcar todo leído
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                  {notifications && notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`group relative flex flex-col gap-1 rounded-lg p-2.5 text-left text-xs transition-colors border ${
                          notif.read
                            ? 'border-transparent text-ink-2 hover:bg-surface-2'
                            : 'border-chip-bd bg-chip/60 text-ink hover:bg-chip'
                        }`}
                      >
                        <div
                          className="cursor-pointer"
                          onClick={() => {
                            setNotifDropdownOpen(false)
                            router.push(`/contacts?leadId=${notif.leadId}&activityId=${notif.activityId}`)
                            // Disparar evento para que la página de contactos reaccione de inmediato
                            window.dispatchEvent(new CustomEvent('open-lead-reminder', {
                              detail: { leadId: notif.leadId, activityId: notif.activityId }
                            }))
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-bold truncate pr-6 group-hover:text-chip-ink transition-colors">
                              {notif.title}
                            </span>
                            <span className="text-[9px] text-ink-3 font-mono flex-shrink-0">
                              {new Date(notif.scheduledAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-2 whitespace-pre-line leading-relaxed truncate max-w-full">
                            {notif.body}
                          </p>
                        </div>

                        {!notif.read && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              await localDb.notifications.update(notif.id, { read: true })
                              await markActivityReminderAsRead(notif.activityId)
                            }}
                            className="absolute bottom-2.5 right-2.5 h-5 w-5 flex items-center justify-center rounded bg-surface-2 border border-border hover:bg-primary hover:border-primary text-ink-2 hover:text-white transition-all"
                            title="Marcar como leído"
                          >
                            <CheckSquare className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-ink-3 text-xs">
                      No tienes recordatorios pendientes
                    </div>
                  )}
                </div>
              </div>
          )}
        </div>

        {/* Dropdown del Usuario */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => {
              setDropdownOpen(!dropdownOpen)
              setNotifDropdownOpen(false)
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-1.5 pr-3 hover:bg-border-2 transition-colors"
          >
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-chip text-chip-ink">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:block text-left text-xs font-semibold text-ink-2">
              <p className="truncate max-w-24">{session?.user?.name || 'Usuario'}</p>
            </div>
          </button>

          {/* Menú desplegable */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 z-30 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                <div className="px-3 py-2 border-b border-border-2 mb-1 text-[11px] text-ink-3 truncate">
                  {session?.user?.email}
                </div>
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                >
                  <Settings className="h-4 w-4 text-ink-3" />
                  Configuración
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-bad hover:bg-bad-bg transition-colors"
                >
                  <LogOut className="h-4 w-4 text-bad" />
                  Cerrar Sesión
                </button>
              </div>
          )}
        </div>
      </div>
    </header>
  )
}
