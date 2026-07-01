'use client'

import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '@/lib/db'

export function useSettings() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Obtener estadísticas de la base de datos local para la sección de almacenamiento
  const localStats = useLiveQuery(
    async () => {
      if (!userId) return { leads: 0, companies: 0 }
      const leads = await localDb.leads.filter((l) => l.userId === userId && l.deleted !== true).count()
      const companies = await localDb.companies.filter((c) => c.deleted !== true).count()
      return { leads, companies }
    },
    [userId],
    { leads: 0, companies: 0 }
  )

  const isMfaActive = session?.user?.twoFactorEnabled !== false

  return {
    status,
    userId,
    session,
    localStats,
    isMfaActive,
  }
}
