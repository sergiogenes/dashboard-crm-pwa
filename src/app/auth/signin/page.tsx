'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { registerUser } from '@/app/actions/auth'
import { Lock, Mail, User, ArrowRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface SignInPageProps {
  searchParams?: { error?: string }
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const errorParam = searchParams?.error

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('mfa_attempts')
    }

    if (errorParam) {
      const errorMessages: { [key: string]: string } = {
        Configuration: 'Hay un problema con la configuración del servidor de autenticación.',
        AccessDenied: 'Acceso denegado. No tienes permisos para ingresar.',
        Verification: 'El token de verificación ha expirado o es inválido.',
        CredentialsSignin: 'Los datos de acceso provistos son incorrectos.',
        MfaAttemptsExceeded: 'Has superado el número máximo de intentos permitidos para el código MFA. Por seguridad, debes volver a iniciar sesión.',
        Default: 'Ocurrió un error al intentar autenticarse con el servidor.',
      }
      setError(errorMessages[errorParam] || errorMessages.Default)
    }
  }, [errorParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!email || !password) {
      setError('Por favor, completa todos los campos requeridos.')
      setLoading(false)
      return
    }

    // 1. Validar conexión local
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setError('No tienes conexión a Internet. Por favor, conéctate para iniciar sesión.')
      setLoading(false)
      return
    }

    // 2. Validar que el servidor de autenticación esté respondiendo (20s de margen para compilación en frío o Atlas connection)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)
      const healthCheck = await fetch('/api/health', {
        signal: controller.signal
      }).catch(() => null)
      clearTimeout(timeoutId)

      if (!healthCheck || !healthCheck.ok) {
        setError('El servidor de autenticación no está disponible. Comprueba tu conexión.')
        setLoading(false)
        return
      }
    } catch {
      // Continuar si hay algún fallo imprevisto en la validación rápida
    }

    try {
      if (isLogin) {
        // Iniciar sesión
        const result = await signIn('credentials', {
          email: email.toLowerCase(),
          password,
          redirect: false,
        })

        if (result?.error) {
          setError(result.error)
        } else {
          window.location.replace('/')
        }
      } else {
        // Registrar usuario
        if (!name) {
          setError('El nombre es requerido para registrarse.')
          setLoading(false)
          return
        }

        const regResult = await registerUser({ name, email, password })

        if (!regResult.success) {
          setError(regResult.error || 'Ocurrió un error al registrarse')
        } else {
          // Loguearse automáticamente tras registrarse
          const loginResult = await signIn('credentials', {
            email: email.toLowerCase(),
            password,
            redirect: false,
          })

          if (loginResult?.error) {
            setError('Usuario creado pero no se pudo iniciar sesión automáticamente. Intenta ingresar manualmente.')
            setIsLogin(true)
          } else {
            window.location.replace('/')
          }
        }
      }
    } catch (err: any) {
      console.error('[SignIn UI] Error:', err)
      setError('Error inesperado. Inténtalo de nuevo.')
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
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            {isLogin ? 'Accede al panel del CRM Offline-First' : 'Registra un nuevo usuario para las pruebas'}
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

            <form className="space-y-6" onSubmit={handleSubmit} method="POST">
              {!isLogin && (
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-ink-2">
                    Nombre Completo
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-5 w-5 text-ink-3" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required={!isLogin}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Juan Pérez"
                      className="block w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

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
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-ink-2">
                  Contraseña
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
                    placeholder="••••••••"
                    className="block w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-primary hover:text-accent transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}

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
                      {isLogin ? 'Ingresar' : 'Registrarse'}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError(null)
                }}
                className="text-sm font-medium text-primary hover:text-accent transition-colors"
              >
                {isLogin
                  ? '¿No tienes una cuenta? Regístrate gratis'
                  : '¿Ya tienes una cuenta? Inicia sesión'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
