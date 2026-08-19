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
      {/* Backdrop: sin onClick a propósito — cerrar el modal acá borraría todo
          lo tipeado en el formulario ante un clic accidental. Cerrar
          requiere el botón X o "Cancelar", ambos explícitos. */}
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="animate-in fade-in zoom-in-95 relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl duration-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Building2 className="h-5 w-5 text-primary" />
            {companyToEdit ? 'Editar Empresa' : 'Nueva Empresa'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido / Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-bad-bd bg-bad-bg p-3 text-xs text-bad">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Nombre de la Empresa *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building2 className="h-4.5 w-4.5 text-ink-3" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Google Inc."
                className="block w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Dominio Web (Opcional)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Globe className="h-4.5 w-4.5 text-ink-3" />
              </div>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="google.com"
                className="block w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-cta-bg px-5 py-2.5 text-sm font-semibold text-cta-ink shadow-lg transition-colors hover:bg-accent disabled:opacity-50"
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
