'use client'

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'

import { useSession } from 'next-auth/react'
import { localDb } from '@/lib/db'

function SessionPurgeObserver() {
  const { status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('[SessionPurgeObserver] User is unauthenticated. Purging IndexedDB...')
      localDb.delete().then(() => {
        localDb.open().catch((err) => {
          console.error('[SessionPurgeObserver] Failed to reopen database:', err)
        })
      }).catch((err) => {
        console.error('[SessionPurgeObserver] Failed to delete database:', err)
      })
    }
  }, [status])

  return null
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // Registrar marcador de hidratación para tests E2E
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__hydrated = true
    }
  }, [])

  // Crear el QueryClient usando useState para garantizar que sea un singleton por sesión de cliente
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 0, // Fallar rápido offline para evitar esperas y bucles infinitos
            refetchOnWindowFocus: false, // No refescar al cambiar de pestaña offline
            refetchOnReconnect: false, // La reconexión es manejada por el orquestador useSync
            staleTime: Infinity, // Confiar en la base de datos local Dexie como SSOT
          },
        },
      })
  )

  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <SessionPurgeObserver />
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}

