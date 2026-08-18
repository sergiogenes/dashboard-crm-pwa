'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { verifyMFA } from '@/app/actions/mfa'
import { ShieldCheck, LogOut, AlertCircle, ArrowRight } from 'lucide-react'

export default function MfaPage() {
  const { update } = useSession()
  const router = useRouter()

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0) // Contador de intentos fallidos

  // Recuperar intentos previos almacenados en sessionStorage para evitar bypass con F5
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('mfa_attempts')
      if (stored) {
        setAttempts(parseInt(stored, 10))
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) {
      setError('Por favor, ingresa tu código de verificación.')
      return
    }

    // Prevenir más submits si ya se excedió el número de intentos y se está redirigiendo
    if (attempts >= 3) return

    setError(null)
    setLoading(true)

    try {
      const res = await verifyMFA(code)
      if (res && res.success && res.mfaToken) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('mfa_attempts')
        }
        // Actualizar la sesión en el cliente con el mfaToken de verificación
        await update({ mfaToken: res.mfaToken })
        // Redirigir al Dashboard
        window.location.replace('/')
      } else {
        const nextAttempts = attempts + 1
        setAttempts(nextAttempts)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('mfa_attempts', nextAttempts.toString())
        }

        if (nextAttempts >= 3) {
          setError('Se ha excedido el número máximo de intentos de verificación (3). Cerrando sesión...')
          setLoading(true) // Bloquear botones visualmente
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('mfa_attempts')
          }
          setTimeout(() => {
            signOut({ callbackUrl: '/auth/signin?error=MfaAttemptsExceeded' })
          }, 2000)
        } else {
          setError(`${res?.error || 'El código ingresado es incorrecto.'} Intentos restantes: ${3 - nextAttempts}`)
        }
      }
    } catch (err) {
      console.error('[MFA Verify UI] Error:', err)
      setError('Ocurrió un error al validar la clave de seguridad.')
    } finally {
      if (attempts < 2) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-accent-2/20 blur-[100px]" />

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cta-bg shadow-lg">
            <ShieldCheck className="h-6 w-6 text-cta-ink animate-pulse" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
            Verificación de Seguridad
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Ingresa tu código de 6 dígitos o un código de recuperación
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8 shadow-2xl">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-bad-bd bg-bad-bg p-4 text-sm text-bad">
              <AlertCircle className="h-5 w-5 shrink-0 text-bad" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" method="POST">
            <div>
              <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-ink-2">
                Código de Seguridad
              </label>
              <input
                id="code"
                type="text"
                maxLength={10}
                required
                autoFocus // UX: Foco automático en el campo al cargar
                disabled={attempts >= 3}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000 o código de backup"
                className="mt-1 block w-full rounded-xl border border-border bg-surface py-3 text-center text-lg font-mono tracking-widest text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || attempts >= 3}
              className="group relative flex w-full justify-center rounded-xl bg-cta-bg py-3.5 px-4 text-sm font-semibold text-cta-ink shadow-lg transition-all hover:bg-accent disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cta-ink border-t-transparent" />
              ) : (
                <span className="flex items-center gap-2">
                  Verificar e Ingresar
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-6 text-center">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('mfa_attempts')
                }
                signOut({ callbackUrl: '/auth/signin' })
              }}
              className="inline-flex items-center gap-2 text-xs font-medium text-ink-3 hover:text-bad transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Cancelar y Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
