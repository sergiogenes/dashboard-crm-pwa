'use client'

import { Wallet } from 'lucide-react'

export default function DealsPage() {
  return (
    <div className="space-y-6">
      {/* Sección de Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
          <Wallet className="h-8 w-8 text-indigo-400" />
          Deals Page
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Esta sección está reservada para la futura integración de negocios y tratos comerciales con el CRM.
        </p>
      </div>

      {/* Tarjeta de Contenido Simple */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-8 text-center backdrop-blur-md">
        <p className="text-slate-500 text-sm">
          Módulo de negocios no habilitado temporalmente.
        </p>
      </div>
    </div>
  )
}
