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
  const { data: session, status } = useSession()
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

  // Spinner de carga inicial para la sesión
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
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
    <div className="flex min-h-screen bg-slate-950 text-slate-100 animate-fade-in overflow-x-hidden">
      {/* Barra lateral de navegación sticky */}
      <Sidebar />

      {/* Contenedor del contenido principal */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        
        {/* Panel central de visualización */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
