'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPassword } from '@/app/actions/password-reset'
import { Lock, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token || !email) {
      setError('El enlace de restablecimiento es inválido, incompleto o le faltan parámetros.')
    }
  }, [token, email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(false)

    if (!token || !email) {
      setError('Faltan parámetros en el enlace. Por favor, solicita uno nuevo.')
      return
    }

    if (!password || !confirmPassword) {
      setError('Por favor, completa todos los campos.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      setError('No tienes conexión a Internet. Por favor, conéctate para continuar.')
      return
    }

    setLoading(true)

    try {
      const result = await resetPassword({ token, email, password })

      if (!result.success) {
        setError(result.error || 'Ocurrió un error al restablecer tu contraseña.')
      } else {
        setSuccess(true)
      }
    } catch (err) {
      console.error('[Reset Password UI] Error:', err)
      setError('Ocurrió un error inesperado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-2xl">
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-bad-bd bg-bad-bg p-4 text-sm text-bad">
          <AlertCircle className="h-5 w-5 shrink-0 text-bad" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="text-center space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-bg text-ok">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-ok">Contraseña Restablecida</p>
            <p className="text-xs text-ink-2">
              Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tus nuevas credenciales.
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-accent transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Iniciar Sesión
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit} method="POST">
          <div>
            <label htmlFor="emailDisplay" className="block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Correo Solicitante
            </label>
            <input
              id="emailDisplay"
              type="text"
              disabled
              value={email || ''}
              className="mt-1 block w-full rounded-xl border border-border bg-surface/40 py-3 px-4 text-sm text-ink-3 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Nueva Contraseña
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-ink-3" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="block w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Confirmar Contraseña
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-ink-3" />
              </div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className="block w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !token || !email}
              className="group relative flex w-full justify-center rounded-xl bg-cta-bg py-3.5 px-4 text-sm font-semibold text-cta-ink shadow-lg transition-all hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cta-ink border-t-transparent" />
              ) : (
                <span className="flex items-center gap-2">
                  Cambiar Contraseña
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-12 sm:px-6 lg:px-8">
      {/* Luces de fondo (Gradientes Ambientales) */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-accent-2/20 blur-[100px]" />

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/negofin-logo.png" alt="NegoFIN" className="mx-auto h-14 w-auto" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Nueva Contraseña
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Escribe y confirma tu nueva contraseña de acceso
          </p>
        </div>

        <div className="mt-8">
          <Suspense fallback={
            <div className="rounded-2xl border border-border bg-surface p-8 shadow-2xl flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
