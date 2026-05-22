'use client'

import Link from 'next/link'
import { WifiOff, RotateCw, Database } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-indigo-500 shadow-xl">
        <WifiOff className="h-10 w-10 animate-pulse text-indigo-400" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></span>
        </span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        Sin Conexión a Internet
      </h1>
      <p className="mt-4 max-w-md text-base text-slate-400">
        El servidor no responde o estás sin conexión. Sin embargo, tu base de datos local (<strong className="text-indigo-400">IndexedDB</strong>) sigue completamente activa para consultar y crear leads/empresas de forma local.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-700 transition-colors"
        >
          <Database className="h-4 w-4" />
          Ir al Panel Local
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-300 hover:text-white transition-all"
        >
          <RotateCw className="h-4 w-4" />
          Reintentar Conexión
        </button>
      </div>
    </div>
  )
}
