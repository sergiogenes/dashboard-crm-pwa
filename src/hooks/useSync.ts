import { useEffect, useState, useCallback, useRef } from 'react'
import { localDb } from '@/lib/db'
import { pushClientChanges, pullServerUpdates } from '@/app/actions/sync'
import { useQueryClient } from '@tanstack/react-query'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

/**
 * Hook personalizado de sincronización cliente-servidor.
 * Gestiona la subida de cambios locales (Dexie -> MongoDB) resolviendo IDs temporales
 * a IDs reales de MongoDB, y descarga cambios entrantes (MongoDB -> Dexie).
 * Incorpora detección de estado online/offline y ping ligero de salud del servidor
 * (Lie-Fi protection) antes de subir datos.
 */
export function useSync(userId: string | undefined) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true
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
      // 1. Obtener datos locales modificados de Dexie
      const unsyncedCompanies = await localDb.companies
        .filter(c => c.synced === false)
        .toArray()

      const unsyncedLeads = await localDb.leads
        .filter(l => l.synced === false && l.userId === userId)
        .toArray()

      const hasPendingChanges = unsyncedCompanies.length > 0 || unsyncedLeads.length > 0
      let companyMappings: { tempId: string; id: string }[] = []
      let leadMappings: { tempId: string; id: string }[] = []

      // 2. Subir cambios si existen
      if (hasPendingChanges) {
        const response = await pushClientChanges(
          unsyncedLeads.map(({ synced, ...rest }) => rest),
          unsyncedCompanies.map(({ synced, ...rest }) => rest)
        )

        if (!response.success) {
          throw new Error('Error al sincronizar datos con el servidor')
        }

        companyMappings = response.companyMappings
        leadMappings = response.leadMappings

        // Actualizar Dexie aplicando IDs reales y eliminando elementos soft-deleted
        for (const comp of unsyncedCompanies) {
          if (comp.tempId) {
            const mapping = companyMappings.find(m => m.tempId === comp.tempId)
            if (mapping) {
              if (comp.deleted) {
                await localDb.companies.where('tempId').equals(comp.tempId).delete()
              } else {
                await localDb.companies.where('tempId').equals(comp.tempId).modify({
                  id: mapping.id,
                  synced: true,
                })
              }
            }
          } else if (comp.id) {
            if (comp.deleted) {
              await localDb.companies.where('id').equals(comp.id).delete()
            } else {
              await localDb.companies.where('id').equals(comp.id).modify({ synced: true })
            }
          }
        }

        for (const lead of unsyncedLeads) {
          if (lead.tempId) {
            const mapping = leadMappings.find(m => m.tempId === lead.tempId)
            if (mapping) {
              if (lead.deleted) {
                await localDb.leads.where('tempId').equals(lead.tempId).delete()
              } else {
                let resolvedCompanyId = lead.companyId
                if (lead.companyId) {
                  const compMapping = companyMappings.find(m => m.tempId === lead.companyId)
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
          } else if (lead.id) {
            if (lead.deleted) {
              await localDb.leads.where('id').equals(lead.id).delete()
            } else {
              let resolvedCompanyId = lead.companyId
              if (lead.companyId) {
                const compMapping = companyMappings.find(m => m.tempId === lead.companyId)
                if (compMapping) {
                  resolvedCompanyId = compMapping.id
                }
              }
              await localDb.leads.where('id').equals(lead.id).modify({
                companyId: resolvedCompanyId,
                synced: true,
              })
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
          let existingLocal = await localDb.companies.where('id').equals(serverComp.id).first()
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
        } else {
          // Buscar si ya existe localmente el lead usando el ID de MongoDB o por email
          let existingLocal = await localDb.leads.where('id').equals(serverLead.id).first()
          if (!existingLocal) {
            existingLocal = await localDb.leads
              .where('email')
              .equals(serverLead.email)
              .filter(l => l.userId === serverLead.userId)
              .first()
          }

          await localDb.leads.put({
            tempId: existingLocal?.tempId || serverLead.id,
            id: serverLead.id,
            userId: serverLead.userId,
            firstName: serverLead.firstName,
            lastName: serverLead.lastName,
            email: serverLead.email,
            phone: serverLead.phone,
            companyId: serverLead.companyId,
            scoring: serverLead.scoring, // Persistir el scoring en Dexie
            synced: true,
            createdAt: serverLead.createdAt,
            updatedAt: serverLead.updatedAt,
          })
        }
      }

      // Guardar facturas en Dexie (Inbound Sync)
      if (updates.invoices && updates.invoices.length > 0) {
        // Limpiar facturas previas de los leads recibidos en IndexedDB antes de insertar las nuevas
        const leadIds = Array.from(new Set(updates.invoices.map((inv: any) => inv.leadId)))
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
            status: inv.status,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
            paymentDate: inv.paymentDate,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt,
          }))
        )
      }

      localStorage.setItem(lastSyncKey, Date.now().toString())
      queryClient.invalidateQueries()
      setSyncStatus('success')
    } catch (error: any) {
      console.error('[Sync Hook] Falló la sincronización:', error)
      setSyncStatus('error')
      setSyncError(error.message || 'Error desconocido al sincronizar')
    } finally {
      syncInProgressRef.current = false
    }
  }, [userId, queryClient])

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
