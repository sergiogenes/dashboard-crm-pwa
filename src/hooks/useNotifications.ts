'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '@/lib/db'
import { decryptLead, decryptActivity } from '@/lib/client-crypto'

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
        const dbKey = session?.user?.dbEncryptionKey
        const existingNotifications = await localDb.notifications
          .where('userId')
          .equals(userId)
          .toArray()

        const notificationMap = new Map(
          existingNotifications.map((n) => [n.activityId, n])
        )

        for (const rawAct of activities) {
          const act = await decryptActivity(rawAct, dbKey)
          const actKey = act.tempId || act.id
          if (!actKey) continue

          const existingNotif = notificationMap.get(actKey)

          const scheduledAt = act.reminderDate ? Number(act.reminderDate) : 0
          // reminderStatus es la fuente de verdad; reminderRead (deprecado)
          // es el fallback para registros viejos que todavía no lo tienen.
          const reminderStatus =
            act.reminderStatus || (act.reminderRead ? 'waiting' : 'active')
          const isRead = reminderStatus !== 'active'

          // Un recordatorio "Realizado" ya no debe aparecer en la campanita
          // -- igual que uno borrado, se quita del todo en vez de solo
          // marcarse leído.
          if (
            act.deleted ||
            !scheduledAt ||
            isNaN(scheduledAt) ||
            reminderStatus === 'completed'
          ) {
            if (existingNotif) {
              await localDb.notifications.delete(existingNotif.id)
            }
            continue
          }

          // Buscar información del lead asociado y desencriptarlo en caliente
          const rawLead =
            (await localDb.leads.where('tempId').equals(act.leadId).first()) ||
            (await localDb.leads.where('id').equals(act.leadId).first())
          const lead = rawLead ? await decryptLead(rawLead, dbKey) : null
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
              read: isRead,
              notified: isRead,
              createdAt: Date.now(),
            }
            await localDb.notifications.put(newNotif)
          } else {
            const dateChanged = Number(existingNotif.scheduledAt) !== scheduledAt
            const readStateChanged = existingNotif.read !== isRead

            if (dateChanged || readStateChanged) {
              await localDb.notifications.update(existingNotif.id, {
                scheduledAt,
                read: isRead,
                notified: isRead,
              })
            }
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
  }, [userId, activities, session])

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
