'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { generateMfaSetup, enableMFA } from '@/app/actions/mfa'
import { KeyRound, ShieldCheck, Download, Copy, AlertCircle, ClipboardCheck, ArrowRight } from 'lucide-react'

export default function MfaSetupPage() {
  const { data: session, update } = useSession()
  const router = useRouter()

  const [loadingSetup, setLoadingSetup] = useState(true)
  const [loadingVerify, setLoadingVerify] = useState(false)
  const [secret, setSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)

  const initiatedRef = useRef(false)

  useEffect(() => {
    async function loadSetup() {
      setError(null)
      const res = await generateMfaSetup()
      if (res && res.success && res.qrCodeUrl) {
        setSecret(res.secret)
        setQrCodeUrl(res.qrCodeUrl)
      } else {
        setError(res?.error || 'No se pudo generar el código de configuración. Refresca la página.')
        initiatedRef.current = false
      }
      setLoadingSetup(false)
    }

    if (session?.user && !backupCodes && !initiatedRef.current) {
      initiatedRef.current = true
      loadSetup()
    }
  }, [session, backupCodes])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || code.length < 6) {
      setError('Por favor, ingresa el código de 6 dígitos.')
      return
    }

    setError(null)
    setLoadingVerify(true)

    try {
      const res = await enableMFA(secret, code)
      if (res && res.success && res.backupCodes && res.mfaToken) {
        setBackupCodes(res.backupCodes)
        // Actualizar la sesión del navegador para marcar el MFA verificado
        await update({ mfaToken: res.mfaToken })
      } else {
        setError(res?.error || 'Código incorrecto. Inténtalo nuevamente.')
      }
    } catch (err) {
      console.error('[MFA Setup UI] Error:', err)
      setError('Ocurrió un error al verificar el código.')
    } finally {
      setLoadingVerify(false)
    }
  }

  const copyToClipboard = () => {
    if (!backupCodes) return
    const text = backupCodes.join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadBackupCodes = () => {
    if (!backupCodes) return
    const text = `CÓDIGOS DE RECUPERACIÓN - CRM DASHBOARD\nGuarda este archivo en un lugar seguro.\n\n${backupCodes.join('\n')}`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'crm-backup-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFinalize = () => {
    window.location.replace('/')
  }

  if (loadingSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-violet-600/10 blur-[100px]" />

      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <KeyRound className="h-6 w-6 text-white animate-pulse" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-indigo-200 via-indigo-100 to-violet-200 bg-clip-text text-transparent">
            Configurar Seguridad (MFA)
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {backupCodes ? 'Guarda tus códigos de recuperación' : 'Activa la autenticación de doble factor obligatoria'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {!backupCodes ? (
            <div className="space-y-6">
              <div className="text-sm text-slate-300 space-y-3">
                <p>1. Descarga una aplicación de autenticación como <strong>Google Authenticator</strong> o <strong>Authy</strong> en tu móvil.</p>
                <p>2. Escanea el código QR que se muestra a continuación:</p>
              </div>

              {qrCodeUrl && (
                <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="MFA QR Code" className="h-full w-full" />
                </div>
              )}

              <div className="text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Clave de configuración manual:</span>
                <code className="rounded bg-slate-950 px-3 py-1.5 text-sm font-mono text-indigo-300 border border-slate-800 select-all block break-all">
                  {secret}
                </code>
              </div>

              <form onSubmit={handleVerify} className="space-y-4 pt-4 border-t border-slate-800" method="POST">
                <div>
                  <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Ingresa el Código de 6 dígitos
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus // UX: Foco automático en el campo de configuración
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 text-center text-lg font-mono tracking-widest text-white transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingVerify}
                  className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 py-3.5 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50"
                >
                  {loadingVerify ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Verificar y Activar
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
                <span>¡El doble factor ha sido activado correctamente!</span>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white">Códigos de Recuperación</h4>
                <p className="text-xs text-slate-400">
                  Si pierdes acceso a tu dispositivo, puedes usar uno de estos códigos para iniciar sesión. <strong>Solo se pueden usar una vez.</strong> Guárdalos ahora en un lugar seguro.
                </p>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-sm text-indigo-300">
                  {backupCodes.map((codeStr, idx) => (
                    <div key={idx} className="flex justify-center py-1">
                      {codeStr}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-200 py-3.5 hover:bg-slate-800 transition-colors"
                >
                  {copied ? (
                    <>
                      <ClipboardCheck className="h-4 w-4 text-emerald-400" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={downloadBackupCodes}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-200 py-3.5 hover:bg-slate-800 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Descargar (.txt)
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinalize}
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 py-3.5 px-4 text-sm font-semibold text-white hover:from-indigo-600 hover:to-violet-700 transition-all"
              >
                Completar e Ingresar
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
