'use client'

import { useSync } from '@/hooks/useSync'
import { localDb } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, CloudOff, CloudUpload, AlertCircle, RefreshCw } from 'lucide-react'

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
    return (
      <div
        title="Estás trabajando sin conexión. Los cambios se guardarán localmente."
        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-medium text-slate-400 backdrop-blur"
      >
        <CloudOff className="h-4 w-4 text-slate-500" />
        <span className="hidden md:inline">Sin Conexión</span>
        {unsyncedCount > 0 && (
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-700 px-2 text-[10px] font-bold text-slate-200">
            {unsyncedCount}
          </span>
        )}
      </div>
    )
  }

  // 2. Caso Sincronizando
  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-300 backdrop-blur">
        <CloudUpload className="h-4 w-4 text-blue-400 animate-pulse" />
        <span className="hidden md:inline">Sincronizando...</span>
      </div>
    )
  }

  // 3. Caso Errores persistentes
  if (syncStatus === 'error') {
    return (
      <button
        onClick={handleSyncClick}
        title={`Error al sincronizar: ${syncError}. Haz clic para reintentar.`}
        className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3.5 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25 backdrop-blur"
      >
        <AlertCircle className="h-4 w-4 text-red-400" />
        <span className="hidden md:inline">Error de Sincronización</span>
        <RefreshCw className="h-3.5 w-3.5 text-red-400" />
      </button>
    )
  }

  // 4. Caso Cambios locales pendientes (Online)
  if (unsyncedCount > 0) {
    return (
      <button
        onClick={handleSyncClick}
        title="Hay cambios locales pendientes. Haz clic para sincronizar ahora."
        className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/25 backdrop-blur animate-pulse"
      >
        <CloudUpload className="h-4 w-4 text-amber-400" />
        <span className="hidden md:inline">Cambios Pendientes</span>
        <span className="flex h-5 items-center justify-center rounded-full bg-amber-500/20 px-2 text-[10px] font-bold text-amber-200">
          {unsyncedCount}
        </span>
      </button>
    )
  }

  // 5. Sincronizado Completamente (Online)
  return (
    <div
      title="Todos los datos están en la nube."
      className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur"
    >
      <Cloud className="h-4 w-4 text-emerald-400" />
      <span className="hidden md:inline">Sincronizado</span>
    </div>
  )
}
