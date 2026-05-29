'use client'

import { useState } from 'react'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) {
      setError('Por favor, ingresa tu código de verificación.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await verifyMFA(code)
      if (res && res.success && res.mfaToken) {
        // Actualizar la sesión en el cliente con el mfaToken de verificación
        await update({ mfaToken: res.mfaToken })
        // Redirigir al Dashboard
        window.location.replace('/')
      } else {
        setError(res?.error || 'El código ingresado es incorrecto o expiró.')
      }
    } catch (err) {
      console.error('[MFA Verify UI] Error:', err)
      setError('Ocurrió un error al validar la clave de seguridad.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-violet-600/10 blur-[100px]" />

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="h-6 w-6 text-white animate-pulse" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-indigo-200 via-indigo-100 to-violet-200 bg-clip-text text-transparent">
            Verificación de Seguridad
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Ingresa tu código de 6 dígitos o un código de recuperación
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" method="POST">
            <div>
              <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Código de Seguridad
              </label>
              <input
                id="code"
                type="text"
                maxLength={10}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000 o código de backup"
                className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-650 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 py-3.5 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="flex items-center gap-2">
                  Verificar e Ingresar
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-6 text-center">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-red-400 transition-colors"
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
