'use client'

import { useSync } from '@/hooks/useSync'
import { localDb } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, CloudOff, CloudUpload, AlertCircle, RefreshCw } from 'lucide-react'
import { SYNC_STATUS_STYLES } from '@/lib/theme/status'

interface SyncStatusBadgeProps {
  userId: string | undefined
}

export default function SyncStatusBadge({ userId }: SyncStatusBadgeProps) {
  const { isOnline, syncStatus, syncError, triggerSync } = useSync(userId)

  // Obtener reactivamente el recuento de registros no sincronizados
  const unsyncedCount = useLiveQuery(
    async () => {
      if (!userId) return 0
      const compCount = await localDb.companies
        .filter((c) => c.synced === false && c.userId === userId)
        .count()
      const leadCount = await localDb.leads
        .filter((l) => l.synced === false && l.userId === userId)
        .count()
      const activityCount = await localDb.activities
        .filter((a) => a.synced === false && a.userId === userId)
        .count()
      return compCount + leadCount + activityCount
    },
    [userId],
    0
  )

  const handleSyncClick = () => {
    if (isOnline && syncStatus !== 'syncing') {
      triggerSync()
    }
  }

  // 1. Caso Offline
  if (!isOnline) {
    const s = SYNC_STATUS_STYLES.offline
    return (
      <div
        title="Estás trabajando sin conexión. Los cambios se guardarán localmente."
        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur ${s.container}`}
      >
        <CloudOff className={`h-4 w-4 ${s.icon}`} />
        <span className="hidden md:inline">Sin Conexión</span>
        {unsyncedCount > 0 && (
          <span className="flex h-5 items-center justify-center rounded-full bg-surface-2 px-2 text-[10px] font-bold text-ink-2">
            {unsyncedCount}
          </span>
        )}
      </div>
    )
  }

  // 2. Caso Sincronizando
  if (syncStatus === 'syncing') {
    const s = SYNC_STATUS_STYLES.syncing
    return (
      <div className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur ${s.container}`}>
        <CloudUpload className={`h-4 w-4 animate-pulse ${s.icon}`} />
        <span className="hidden md:inline">Sincronizando...</span>
      </div>
    )
  }

  // 3. Caso Errores persistentes
  if (syncStatus === 'error') {
    const s = SYNC_STATUS_STYLES.error
    return (
      <button
        onClick={handleSyncClick}
        title={`Error al sincronizar: ${syncError}. Haz clic para reintentar.`}
        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-bad-bg/70 backdrop-blur ${s.container}`}
      >
        <AlertCircle className={`h-4 w-4 ${s.icon}`} />
        <span className="hidden md:inline">Error de Sincronización</span>
        <RefreshCw className={`h-3.5 w-3.5 ${s.icon}`} />
      </button>
    )
  }

  // 4. Caso Cambios locales pendientes (Online)
  if (unsyncedCount > 0) {
    const s = SYNC_STATUS_STYLES.pending
    return (
      <button
        onClick={handleSyncClick}
        title="Hay cambios locales pendientes. Haz clic para sincronizar ahora."
        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-warn-bg/70 backdrop-blur ${s.container}`}
      >
        <CloudUpload className={`h-4 w-4 ${s.icon}`} />
        <span className="hidden md:inline">Cambios Pendientes</span>
        <span className="flex h-5 items-center justify-center rounded-full bg-warn-bd px-2 text-[10px] font-bold text-warn">
          {unsyncedCount}
        </span>
      </button>
    )
  }

  // 5. Sincronizado Completamente (Online)
  const s = SYNC_STATUS_STYLES.synced
  return (
    <div
      title="Todos los datos están en la nube."
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur ${s.container}`}
    >
      <Cloud className={`h-4 w-4 ${s.icon}`} />
      <span className="hidden md:inline">Sincronizado</span>
    </div>
  )
}
