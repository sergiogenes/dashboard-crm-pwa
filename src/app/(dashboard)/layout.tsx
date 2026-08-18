'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useNotifications } from '@/hooks/useNotifications'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  useNotifications()

  useEffect(() => {
    // Si la sesión de NextAuth ya resolvió que está autenticada
    if (status === 'authenticated' && session?.user) {
      const { mfaRequired, mfaVerified, twoFactorEnabled } = session.user

      // Si el MFA es obligatorio y aún no ha sido verificado en esta sesión
      if (mfaRequired && !mfaVerified) {
        if (twoFactorEnabled) {
          router.replace('/auth/mfa')
        } else {
          router.replace('/auth/mfa-setup')
        }
      }
    }
  }, [session, status, router])

  // Auto-recuperación si el fetch inicial de sesión quedó colgado (p. ej. el
  // servidor de desarrollo se reinició con la pestaña ya abierta). Reintenta
  // con update() en vez de forzar al usuario a recargar la página manualmente.
  useEffect(() => {
    if (status !== 'loading') return
    const interval = setInterval(() => {
      update()
    }, 5000)
    return () => clearInterval(interval)
  }, [status, update])

  // Spinner de carga inicial para la sesión
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg text-ink-2">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <p className="text-sm font-medium animate-pulse">Verificando credenciales de seguridad...</p>
      </div>
    )
  }

  // Prevenir que el cascarón visual del panel se muestre si el MFA no está validado
  const isMfaValid = !session?.user?.mfaRequired || session?.user?.mfaVerified

  if (!session || !isMfaValid) {
    return null // Evita el bypass visual sirviendo pantalla en blanco antes de redirigir
  }

  return (
    <div className="flex min-h-screen md:h-screen bg-bg text-ink animate-fade-in overflow-x-hidden md:overflow-hidden">
      {/* Barra lateral de navegación sticky */}
      <Sidebar />

      {/* Contenedor del contenido principal */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        
        {/* Panel central de visualización */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  )
}
