'use client'

import { useState, useEffect } from 'react'
import { localDb, LocalLead, LocalCompany } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, User, Mail, Phone, Building2, Save } from 'lucide-react'

interface LeadFormModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  leadToEdit?: LocalLead | null
}

export default function LeadFormModal({
  isOpen,
  onClose,
  userId,
  leadToEdit,
}: LeadFormModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Obtener reactivamente todas las empresas locales disponibles
  const companies = useLiveQuery(
    async () => {
      // Filtrar sólo las que no están eliminadas soft-deleted
      return await localDb.companies.filter((c) => c.deleted !== true && c.userId === userId).toArray()
    },
    [userId],
    []
  )

  useEffect(() => {
    if (leadToEdit) {
      setFirstName(leadToEdit.firstName)
      setLastName(leadToEdit.lastName)
      setEmail(leadToEdit.email)
      setPhone(leadToEdit.phone || '')
      setCompanyId(leadToEdit.companyId || '')
    } else {
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setCompanyId('')
    }
    setError(null)
  }, [leadToEdit, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('El nombre, apellido y correo electrónico son obligatorios.')
      setLoading(false)
      return
    }

    try {
      // Validar si ya existe un lead local activo con el mismo correo electrónico (ignora mayúsculas/minúsculas)
      const existing = await localDb.leads
        .where('email')
        .equalsIgnoreCase(email.trim())
        .filter((l) => l.userId === userId && l.deleted !== true)
        .first()

      if (
        existing &&
        (!leadToEdit ||
          (leadToEdit.tempId !== existing.tempId &&
            leadToEdit.id !== existing.id))
      ) {
        setError('Ya existe un contacto activo con este correo electrónico en tu base de datos.')
        setLoading(false)
        return
      }

      const now = Date.now()
      const resolvedCompanyId = companyId || undefined

      if (leadToEdit) {
        // Modo Edición
        const updateData: Partial<LocalLead> = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          companyId: resolvedCompanyId,
          synced: false, // Forzar resincronización
          updatedAt: now,
        }

        if (leadToEdit.id) {
          await localDb.leads.where('id').equals(leadToEdit.id).modify(updateData)
        } else if (leadToEdit.tempId) {
          await localDb.leads.where('tempId').equals(leadToEdit.tempId).modify(updateData)
        }
      } else {
        // Modo Creación
        const newLead: LocalLead = {
          tempId: crypto.randomUUID(),
          userId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          companyId: resolvedCompanyId,
          synced: false,
          createdAt: now,
          updatedAt: now,
        }

        await localDb.leads.add(newLead)
      }

      onClose()
    } catch (err: any) {
      console.error('[Lead Form] Error saving lead:', err)
      setError('Ocurrió un error al guardar el Lead en IndexedDB.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-400" />
            {leadToEdit ? 'Editar Contacto / Lead' : 'Nuevo Contacto / Lead'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido / Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Nombre *
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4.5 w-4.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan"
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Apellido *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 px-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Correo Electrónico *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan.perez@email.com"
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Teléfono (Opcional)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Phone className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 9 11 1234-5678"
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Empresa Asociada
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building2 className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              >
                <option value="" className="bg-slate-900">Ninguna empresa asociada</option>
                {companies &&
                  companies.map((comp) => (
                    <option
                      key={comp.id || comp.tempId}
                      value={comp.id || comp.tempId}
                      className="bg-slate-900"
                    >
                      {comp.name} {comp.synced ? '(Sincronizada)' : '(Local)'}
                    </option>
                  ))}
              </select>
              {/* Flecha personalizada */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                ▼
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-700 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {leadToEdit ? 'Guardar Cambios' : 'Crear Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
