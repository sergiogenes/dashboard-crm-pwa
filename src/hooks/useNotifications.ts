'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '@/lib/db'

export function useNotifications() {
  const { data: session } = useSession()
  const userId = session?.user?.id || ''

  // Consulta reactiva de las actividades del usuario
  const activities = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.activities.where('userId').equals(userId).toArray()
    },
    [userId]
  )

  // Sincronizar actividades con notificaciones en Dexie (IndexedDB)
  useEffect(() => {
    if (!userId || !activities) return

    const syncNotifications = async () => {
      try {
        const existingNotifications = await localDb.notifications
          .where('userId')
          .equals(userId)
          .toArray()

        const notificationMap = new Map(
          existingNotifications.map((n) => [n.activityId, n])
        )

        for (const act of activities) {
          const actKey = act.tempId || act.id
          if (!actKey) continue

          const existingNotif = notificationMap.get(actKey)

          const scheduledAt = act.reminderDate ? Number(act.reminderDate) : 0

          if (act.deleted || !scheduledAt || isNaN(scheduledAt)) {
            if (existingNotif) {
              await localDb.notifications.delete(existingNotif.id)
            }
            continue
          }
          
          // Buscar información del lead asociado
          const lead = 
            (await localDb.leads.where('tempId').equals(act.leadId).first()) || 
            (await localDb.leads.where('id').equals(act.leadId).first())
          const leadName = lead ? `${lead.firstName} ${lead.lastName}` : 'Contacto'

          if (!existingNotif) {
            const newNotif = {
              id: crypto.randomUUID(),
              activityId: actKey,
              leadId: act.leadId,
              userId: userId,
              title: `Recordatorio: ${act.title}`,
              body: `Lead: ${leadName}\n${act.body.substring(0, 80)}`,
              scheduledAt,
              read: false,
              notified: false,
              createdAt: Date.now(),
            }
            await localDb.notifications.put(newNotif)
          } else if (Number(existingNotif.scheduledAt) !== scheduledAt) {
            await localDb.notifications.update(existingNotif.id, {
              scheduledAt,
              notified: false, // Permitir notificar de nuevo si cambia la fecha
            })
          }
        }

        // Limpiar notificaciones huérfanas de actividades ya no existentes
        const activityKeys = new Set(activities.map((a) => a.tempId || a.id).filter(Boolean))
        for (const notif of existingNotifications) {
          if (notif.activityId && !activityKeys.has(notif.activityId)) {
            await localDb.notifications.delete(notif.id)
          }
        }
      } catch (err) {
        console.error('[Notification Sync] Error syncing notifications:', err)
      }
    }

    syncNotifications()
  }, [userId, activities])

  // Timer para comprobar recordatorios vencidos cada 10s
  useEffect(() => {
    if (!userId) return

    const checkAndTriggerNotifications = async () => {
      try {
        const now = Date.now()
        const dueNotifs = await localDb.notifications
          .where('userId')
          .equals(userId)
          .filter((n) => !n.notified && n.scheduledAt <= now)
          .toArray()

        if (dueNotifs.length === 0) return

        if (Notification.permission === 'default') {
          await Notification.requestPermission()
        }

        for (const notif of dueNotifs) {
          if (Notification.permission === 'granted') {
            try {
              new Notification(notif.title, {
                body: notif.body,
                icon: '/icons/icon-192x192.png',
              })
            } catch (err) {
              console.error('[Web Notification] Error creating system notification:', err)
            }
          }
          await localDb.notifications.update(notif.id, { notified: true })
        }
      } catch (err) {
        console.error('[Notification Trigger] Error checking/triggering notifications:', err)
      }
    }

    checkAndTriggerNotifications()
    const interval = setInterval(checkAndTriggerNotifications, 10000)
    return () => clearInterval(interval)
  }, [userId])
}
