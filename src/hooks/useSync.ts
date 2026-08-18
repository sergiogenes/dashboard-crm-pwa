import { useEffect, useState, useCallback, useRef } from 'react'
import { localDb, LocalLead, LocalActivity } from '@/lib/db'
import { pushClientChanges, pullServerUpdates } from '@/app/actions/sync'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  decryptLead,
  encryptLead,
  decryptActivity,
  encryptActivity,
  decryptLocal
} from '@/lib/client-crypto'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

/**
 * Hook personalizado de sincronización cliente-servidor.
 * Gestiona la subida de cambios locales (Dexie -> MongoDB) resolviendo IDs temporales
 * a IDs reales de MongoDB, y descarga cambios entrantes (MongoDB -> Dexie).
 * Incorpora detección de estado online/offline y ping ligero de salud del servidor
 * (Lie-Fi protection) antes de subir datos.
 */
export function useSync(userId: string | undefined) {
  const { data: session } = useSession()
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true,
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const syncInProgressRef = useRef(false)
  const syncStatusRef = useRef<SyncStatus>('idle')

  // Mantener actualizado el ref del estado para leerlo dentro del intervalo sin reiniciar el efecto
  useEffect(() => {
    syncStatusRef.current = syncStatus
  }, [syncStatus])

  const sync = useCallback(async () => {
    if (!userId || !navigator.onLine || syncInProgressRef.current) return

    syncInProgressRef.current = true
    setSyncStatus('syncing')
    setSyncError(null)

    try {
      const dbKey = session?.user?.dbEncryptionKey

      // 1. Obtener datos locales modificados de Dexie
      const unsyncedCompanies = await localDb.companies
        .filter((c) => c.synced === false)
        .toArray()

      const unsyncedLeads = await localDb.leads
        .filter((l) => l.synced === false && l.userId === userId)
        .toArray()

      const unsyncedActivities = await localDb.activities
        .filter((a) => a.synced === false && a.userId === userId)
        .toArray()

      const unsyncedDeals = await localDb.deals
        .filter((d) => d.synced === false && d.userId === userId)
        .toArray()

      const hasPendingChanges =
        unsyncedCompanies.length > 0 ||
        unsyncedLeads.length > 0 ||
        unsyncedActivities.length > 0 ||
        unsyncedDeals.length > 0

      let companyMappings: { tempId: string; id: string }[] = []
      let leadMappings: { tempId: string; id: string }[] = []
      let activityMappings: { tempId: string; id: string }[] = []
      let dealMappings: { tempId: string; id: string }[] = []

      // 2. Subir cambios si existen
      if (hasPendingChanges) {
        const decryptedLeads = await Promise.all(
          unsyncedLeads.map((l) => decryptLead(l, dbKey))
        )

        const decryptedActivities = await Promise.all(
          unsyncedActivities.map((a) => decryptActivity(a, dbKey))
        )

        const response = await pushClientChanges(
          decryptedLeads.map(({ synced, ...rest }) => rest),
          unsyncedCompanies.map(({ synced, ...rest }) => rest),
          decryptedActivities.map(({ synced, ...rest }) => rest),
          unsyncedDeals.map(({ synced, ...rest }) => rest),
        )

        if (!response.success) {
          throw new Error('Error al sincronizar datos con el servidor')
        }

        companyMappings = response.companyMappings
        leadMappings = response.leadMappings
        activityMappings = response.activityMappings || []
        dealMappings = (response as any).dealMappings || []

        // Actualizar Dexie aplicando IDs reales y eliminando elementos soft-deleted
        for (const comp of unsyncedCompanies) {
          if (comp.id) {
            if (comp.deleted) {
              await localDb.companies.where('id').equals(comp.id).delete()
            } else {
              await localDb.companies
                .where('id')
                .equals(comp.id)
                .modify({ synced: true })
            }
          } else if (comp.tempId) {
            const mapping = companyMappings.find(
              (m) => m.tempId === comp.tempId,
            )
            if (mapping) {
              if (comp.deleted) {
                await localDb.companies
                  .where('tempId')
                  .equals(comp.tempId)
                  .delete()
              } else {
                await localDb.companies
                  .where('tempId')
                  .equals(comp.tempId)
                  .modify({
                    id: mapping.id,
                    synced: true,
                  })
              }
            }
          }
        }

        for (const lead of unsyncedLeads) {
          if (lead.id) {
            if (lead.deleted) {
              await localDb.leads.where('id').equals(lead.id).delete()
            } else {
              let resolvedCompanyId = lead.companyId
              if (lead.companyId) {
                const compMapping = companyMappings.find(
                  (m) => m.tempId === lead.companyId,
                )
                if (compMapping) {
                  resolvedCompanyId = compMapping.id
                }
              }
              await localDb.leads.where('id').equals(lead.id).modify({
                companyId: resolvedCompanyId,
                synced: true,
              })
            }
          } else if (lead.tempId) {
            const mapping = leadMappings.find((m) => m.tempId === lead.tempId)
            if (mapping) {
              if (lead.deleted) {
                await localDb.leads.where('tempId').equals(lead.tempId).delete()
              } else {
                let resolvedCompanyId = lead.companyId
                if (lead.companyId) {
                  const compMapping = companyMappings.find(
                    (m) => m.tempId === lead.companyId,
                  )
                  if (compMapping) {
                    resolvedCompanyId = compMapping.id
                  }
                }

                await localDb.leads.where('tempId').equals(lead.tempId).modify({
                  id: mapping.id,
                  companyId: resolvedCompanyId,
                  synced: true,
                })
              }
            }
          }
        }

        for (const act of unsyncedActivities) {
          if (act.id) {
            if (act.deleted) {
              await localDb.activities.where('id').equals(act.id).delete()
            } else {
              let resolvedLeadId = act.leadId
              if (act.leadId) {
                const leadMapping = leadMappings.find(
                  (m) => m.tempId === act.leadId,
                )
                if (leadMapping) {
                  resolvedLeadId = leadMapping.id
                }
              }
              await localDb.activities.where('id').equals(act.id).modify({
                leadId: resolvedLeadId,
                synced: true,
              })
            }
          } else if (act.tempId) {
            const mapping = activityMappings.find(
              (m) => m.tempId === act.tempId,
            )
            if (mapping) {
              if (act.deleted) {
                await localDb.activities
                  .where('tempId')
                  .equals(act.tempId)
                  .delete()
              } else {
                let resolvedLeadId = act.leadId
                if (act.leadId) {
                  const leadMapping = leadMappings.find(
                    (m) => m.tempId === act.leadId,
                  )
                  if (leadMapping) {
                    resolvedLeadId = leadMapping.id
                  }
                }
                await localDb.activities
                  .where('tempId')
                  .equals(act.tempId)
                  .modify({
                    id: mapping.id,
                    leadId: resolvedLeadId,
                    synced: true,
                  })
              }
            }
          }
        }

        for (const deal of unsyncedDeals) {
          if (deal.id) {
            if (deal.deleted) {
              await localDb.deals.where('id').equals(deal.id).delete()
            } else {
              let resolvedLeadId = deal.leadId
              if (deal.leadId) {
                const leadMapping = leadMappings.find(
                  (m) => m.tempId === deal.leadId,
                )
                if (leadMapping) {
                  resolvedLeadId = leadMapping.id
                }
              }
              await localDb.deals.where('id').equals(deal.id).modify({
                leadId: resolvedLeadId,
                synced: true,
              })
            }
          } else if (deal.tempId) {
            const mapping = dealMappings.find((m) => m.tempId === deal.tempId)
            if (mapping) {
              if (deal.deleted) {
                await localDb.deals.where('tempId').equals(deal.tempId).delete()
              } else {
                let resolvedLeadId = deal.leadId
                if (deal.leadId) {
                  const leadMapping = leadMappings.find(
                    (m) => m.tempId === deal.leadId,
                  )
                  if (leadMapping) {
                    resolvedLeadId = leadMapping.id
                  }
                }
                await localDb.deals.where('tempId').equals(deal.tempId).modify({
                  id: mapping.id,
                  leadId: resolvedLeadId,
                  synced: true,
                })
              }
            }
          }
        }
      }

      // 3. Descargar actualizaciones del servidor (Inbound Sync)
      const lastSyncKey = `last_sync_time_${userId}`
      let lastSyncTime = parseInt(localStorage.getItem(lastSyncKey) || '0', 10)

      // Si la base de datos local de Dexie está vacía, forzar descarga completa desde el servidor (lastSyncTime = 0)
      const localLeadsCount = await localDb.leads.count()
      const localCompaniesCount = await localDb.companies.count()
      if (localLeadsCount === 0 && localCompaniesCount === 0) {
        lastSyncTime = 0
      }

      const updates = await pullServerUpdates(lastSyncTime)

      for (const serverComp of updates.companies) {
        if (serverComp.deleted) {
          await localDb.companies.where('id').equals(serverComp.id).delete()
        } else {
          // Buscar si ya existe localmente la empresa usando el ID de MongoDB o por nombre
          let existingLocal = await localDb.companies
            .where('id')
            .equals(serverComp.id)
            .first()
          if (!existingLocal) {
            existingLocal = await localDb.companies
              .where('name')
              .equals(serverComp.name)
              .first()
          }

          await localDb.companies.put({
            tempId: existingLocal?.tempId || serverComp.id,
            id: serverComp.id,
            userId: serverComp.userId,
            name: serverComp.name,
            domain: serverComp.domain,
            synced: true,
            createdAt: serverComp.createdAt,
            updatedAt: serverComp.updatedAt,
          })
        }
      }

      for (const serverLead of updates.leads) {
        if (serverLead.deleted) {
          await localDb.leads.where('id').equals(serverLead.id).delete()
          await localDb.invoices.where('leadId').equals(serverLead.id).delete() // Borrado en cascada local
          await localDb.activities
            .where('leadId')
            .equals(serverLead.id)
            .delete() // Borrado en cascada local
        } else {
          // Buscar si ya existe localmente el lead usando el ID de MongoDB o desencriptando por email en memoria
          let existingLocal = await localDb.leads
            .where('id')
            .equals(serverLead.id)
            .first()
          if (!existingLocal) {
            const allLeads = await localDb.leads.filter(l => l.userId === serverLead.userId).toArray()
            for (const l of allLeads) {
              const decryptedEmail = dbKey ? await decryptLocal(l.email, dbKey) : l.email
              if (decryptedEmail.toLowerCase() === serverLead.email.toLowerCase()) {
                existingLocal = l
                break
              }
            }
          }

          const leadToSave: LocalLead = {
            tempId: existingLocal?.tempId || serverLead.id,
            id: serverLead.id,
            userId: serverLead.userId,
            firstName: serverLead.firstName,
            lastName: serverLead.lastName,
            email: serverLead.email,
            phone: serverLead.phone,
            documentId: serverLead.documentId,
            companyId: serverLead.companyId,
            scoring: serverLead.scoring, // Persistir el scoring en Dexie
            synced: true,
            createdAt: serverLead.createdAt,
            updatedAt: serverLead.updatedAt,
          }

          const encryptedLead = await encryptLead(leadToSave, dbKey)
          await localDb.leads.put(encryptedLead)
        }
      }

      // Guardar facturas en Dexie (Inbound Sync)
      if (updates.invoices && updates.invoices.length > 0) {
        // Limpiar facturas previas de los leads recibidos en IndexedDB antes de insertar las nuevas
        const leadIds = Array.from(
          new Set(updates.invoices.map((inv: any) => inv.leadId)),
        )
        for (const leadId of leadIds) {
          await localDb.invoices.where('leadId').equals(leadId).delete()
        }

        await localDb.invoices.bulkPut(
          updates.invoices.map((inv: any) => ({
            id: inv.id,
            crmId: inv.crmId,
            leadId: inv.leadId,
            userId: inv.userId,
            amount: inv.amount,
            balanceDue: inv.balanceDue,
            status: inv.status,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
            paymentDate: inv.paymentDate,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt,
          })),
        )
      }

      // Guardar actividades en Dexie (Inbound Sync)
      if (updates.activities && updates.activities.length > 0) {
        for (const serverAct of updates.activities) {
          if (serverAct.deleted) {
            await localDb.activities.where('id').equals(serverAct.id).delete()
          } else {
            // Buscar si ya existe localmente la actividad usando el ID de MongoDB
            let existingLocal = await localDb.activities
              .where('id')
              .equals(serverAct.id)
              .first()
            // Si el push-ack todavía no resolvió el id en el registro local (carrera
            // con el siguiente ciclo de pull), buscar por tempId antes de crear un
            // registro duplicado con clave primaria distinta.
            if (!existingLocal && (serverAct as any).tempId) {
              existingLocal = await localDb.activities
                .where('tempId')
                .equals((serverAct as any).tempId)
                .first()
            }

            // Resolver leadId local si tiene tempId en lugar de ID de MongoDB
            let localLead = await localDb.leads
              .where('id')
              .equals(serverAct.leadId)
              .first()
            const resolvedLeadId = localLead?.tempId || serverAct.leadId

            const actToSave: LocalActivity = {
              tempId: existingLocal?.tempId || (serverAct as any).tempId || serverAct.id,
              id: serverAct.id,
              leadId: resolvedLeadId,
              userId: serverAct.userId,
              type: serverAct.type as any,
              title: serverAct.title,
              body: serverAct.body,
              timestamp: serverAct.timestamp,
              reminderDate: serverAct.reminderDate,
              reminderRead: (serverAct as any).reminderRead || false,
              synced: true,
              createdAt: serverAct.createdAt,
              updatedAt: serverAct.updatedAt,
            }

            const encryptedAct = await encryptActivity(actToSave, dbKey)
            await localDb.activities.put(encryptedAct)
          }
        }
      }

      // Guardar deals en Dexie (Inbound Sync)
      if (updates.deals && updates.deals.length > 0) {
        for (const serverDeal of updates.deals) {
          if (serverDeal.deleted) {
            await localDb.deals.where('id').equals(serverDeal.id).delete()
          } else {
            let existingLocal = await localDb.deals
              .where('id')
              .equals(serverDeal.id)
              .first()
            // Ídem que en actividades: evitar duplicar el registro local si el
            // push-ack todavía no había resuelto el id cuando corrió este pull.
            if (!existingLocal && (serverDeal as any).tempId) {
              existingLocal = await localDb.deals
                .where('tempId')
                .equals((serverDeal as any).tempId)
                .first()
            }
            let localLead = await localDb.leads
              .where('id')
              .equals(serverDeal.leadId)
              .first()
            const resolvedLeadId = localLead?.tempId || serverDeal.leadId

            await localDb.deals.put({
              tempId: existingLocal?.tempId || (serverDeal as any).tempId || serverDeal.id,
              id: serverDeal.id,
              leadId: resolvedLeadId,
              userId: serverDeal.userId,
              name: serverDeal.name,
              amount: serverDeal.amount,
              termMonths: serverDeal.termMonths,
              interestRate: serverDeal.interestRate,
              stage: serverDeal.stage as any,
              notes: serverDeal.notes,
              synced: true,
              createdAt: serverDeal.createdAt,
              updatedAt: serverDeal.updatedAt,
            })
          }
        }
      }

      localStorage.setItem(lastSyncKey, Date.now().toString())
      if (userId) {
        await purgeLocalCache(userId)
      }
      queryClient.invalidateQueries()
      setSyncStatus('success')
    } catch (error: any) {
      console.error('[Sync Hook] Falló la sincronización:', error)
      setSyncStatus('error')
      setSyncError(error.message || 'Error desconocido al sincronizar')
    } finally {
      syncInProgressRef.current = false
    }
  }, [userId, queryClient, session])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      sync()
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  useEffect(() => {
    if (!userId) return

    const checkServerAndSync = async () => {
      if (!navigator.onLine) return

      try {
        const response = await fetch('/api/health')
        if (response.ok) {
          await sync()
        }
      } catch {
        // Servidor caído, reintentar en el próximo polling
      }
    }

    const intervalId = setInterval(checkServerAndSync, 15000)
    sync()

    return () => {
      clearInterval(intervalId)
    }
  }, [userId, sync])

  return {
    isOnline,
    syncStatus,
    syncError,
    triggerSync: sync,
  }
}

async function purgeLocalCache(userId: string) {
  try {
    const totalCount = await localDb.leads.where('userId').equals(userId).count()
    if (totalCount <= 100) return

    // 1. Obtener todos los leads del usuario
    const userLeads = await localDb.leads.where('userId').equals(userId).toArray()
    // Obtener todos los deals del usuario para comprobar préstamos activos
    const userDeals = await localDb.deals.where('userId').equals(userId).toArray()

    // Agrupar leads con préstamos activos
    const activeLeadIds = new Set<string>()
    userDeals.forEach((deal) => {
      if (deal.stage !== 'completed' && deal.stage !== 'refused' && !deal.deleted) {
        activeLeadIds.add(deal.leadId)
      }
    })

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    // Filtrar candidatos a purgar
    const candidates = userLeads.filter((lead) => {
      // Debe estar sincronizado
      if (!lead.synced || lead.deleted) return false
      // No debe tener préstamos activos
      const leadKey = lead.id || lead.tempId || ''
      if (activeLeadIds.has(leadKey)) return false
      // No debe haber sido actualizado en los últimos 7 días
      if (lead.updatedAt >= sevenDaysAgo) return false
      return true
    })

    if (candidates.length === 0) return

    // Ordenar de menor a mayor por updatedAt
    candidates.sort((a, b) => a.updatedAt - b.updatedAt)

    // Determinar cuántos eliminar para estar por debajo de 100
    const excessCount = totalCount - 100
    const toDelete = candidates.slice(0, Math.max(excessCount, candidates.length))

    console.log(`[Cache Purge] Purging ${toDelete.length} expired leads from local cache.`)

    for (const lead of toDelete) {
      const leadKey = lead.id || lead.tempId || ''
      // Eliminar lead
      if (lead.id) {
        await localDb.leads.where('id').equals(lead.id).delete()
      } else if (lead.tempId) {
        await localDb.leads.where('tempId').equals(lead.tempId).delete()
      }

      // Borrado en cascada de sub-entidades asociadas en Dexie
      await localDb.invoices.where('leadId').equals(leadKey).delete()
      await localDb.activities.where('leadId').equals(leadKey).delete()
      await localDb.deals.where('leadId').equals(leadKey).delete()
    }
  } catch (err) {
    console.error('[Cache Purge] Error running purge:', err)
  }
}
