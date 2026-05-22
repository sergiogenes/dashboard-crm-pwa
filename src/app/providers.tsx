'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'

export default function Providers({ children }: { children: React.ReactNode }) {
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
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}
