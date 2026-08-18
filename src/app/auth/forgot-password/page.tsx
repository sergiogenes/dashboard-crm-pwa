'use client'

import { useState } from 'react'
import { requestPasswordReset } from '@/app/actions/password-reset'
import { Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(false)

    if (!email) {
      setError('Por favor, ingresa tu correo electrónico.')
      return
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      setError('No tienes conexión a Internet. Por favor, conéctate para continuar.')
      return
    }

    setLoading(true)

    try {
      const result = await requestPasswordReset(email)

      if (!result.success) {
        setError(result.error || 'Ocurrió un error al procesar tu solicitud.')
      } else {
        setSuccess(true)
      }
    } catch (err) {
      console.error('[Forgot Password UI] Error:', err)
      setError('Ocurrió un error inesperado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

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
            Recuperar Acceso
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Ingresa tu email para recibir un enlace de restablecimiento
          </p>
        </div>

        <div className="mt-8">
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
                  <p className="text-sm font-medium text-ok">Solicitud procesada con éxito</p>
                  <p className="text-xs text-ink-2">
                    Si el correo ingresado está registrado, recibirás un enlace de restablecimiento de contraseña en los próximos minutos.
                  </p>
                </div>
                <div className="pt-4">
                  <Link
                    href="/auth/signin"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-accent transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver a Iniciar Sesión
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit} method="POST">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-ink-2">
                    Email
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-5 w-5 text-ink-3" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@ejemplo.com"
                      className="block w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex w-full justify-center rounded-xl bg-cta-bg py-3.5 px-4 text-sm font-semibold text-cta-ink shadow-lg transition-all hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-cta-ink border-t-transparent" />
                    ) : (
                      <span className="flex items-center gap-2">
                        Enviar Enlace
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {!success && (
              <div className="mt-6 text-center">
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al Inicio
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
