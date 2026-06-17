'use client'

import { useState, useEffect } from 'react'
import { localDb, LocalCompany } from '@/lib/db'
import { X, Building2, Globe, Save } from 'lucide-react'

interface CompanyFormModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  companyToEdit?: LocalCompany | null
}

export default function CompanyFormModal({
  isOpen,
  onClose,
  userId,
  companyToEdit,
}: CompanyFormModalProps) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (companyToEdit) {
      setName(companyToEdit.name)
      setDomain(companyToEdit.domain || '')
    } else {
      setName('')
      setDomain('')
    }
    setError(null)
  }, [companyToEdit, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!name.trim()) {
      setError('El nombre de la empresa es obligatorio.')
      setLoading(false)
      return
    }

    if (domain.trim()) {
      const domainRegex =
        /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
      if (!domainRegex.test(domain.trim())) {
        setError(
          'El dominio web ingresado no es válido (ej. empresa.com o empresa.com.ar).',
        )
        setLoading(false)
        return
      }
    }

    try {
      // Validar si ya existe una empresa local activa con el mismo nombre (ignora mayúsculas/minúsculas)
      const existing = await localDb.companies
        .where('name')
        .equalsIgnoreCase(name.trim())
        .filter((c) => c.deleted !== true)
        .first()

      if (
        existing &&
        (!companyToEdit ||
          (companyToEdit.tempId !== existing.tempId &&
            companyToEdit.id !== existing.id))
      ) {
        setError(
          'Ya existe una empresa activa con este nombre en tu base de datos.',
        )
        setLoading(false)
        return
      }

      const now = Date.now()

      if (companyToEdit) {
        // Modo Edición
        const updateData: Partial<LocalCompany> = {
          name: name.trim(),
          domain: domain.trim() || undefined,
          synced: false, // Forzar resincronización
          updatedAt: now,
        }

        if (companyToEdit.id) {
          await localDb.companies
            .where('id')
            .equals(companyToEdit.id)
            .modify(updateData)
        } else if (companyToEdit.tempId) {
          await localDb.companies
            .where('tempId')
            .equals(companyToEdit.tempId)
            .modify(updateData)
        }
      } else {
        // Modo Creación
        const newCompany: LocalCompany = {
          tempId: crypto.randomUUID(),
          userId,
          name: name.trim(),
          domain: domain.trim() || undefined,
          synced: false,
          createdAt: now,
          updatedAt: now,
        }

        await localDb.companies.add(newCompany)
      }

      onClose()
    } catch (err: any) {
      console.error('[Company Form] Error saving company:', err)
      setError(
        'Ocurrió un error al guardar la empresa en la base de datos local.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="animate-in fade-in zoom-in-95 relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl duration-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Building2 className="h-5 w-5 text-indigo-400" />
            {companyToEdit ? 'Editar Empresa' : 'Nueva Empresa'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido / Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nombre de la Empresa *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building2 className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Google Inc."
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dominio Web (Opcional)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Globe className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="google.com"
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {companyToEdit ? 'Guardar Cambios' : 'Crear Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
