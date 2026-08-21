'use client'

import { useState, useEffect } from 'react'
import { localDb, LocalLead, LocalCompany } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSession } from 'next-auth/react'
import { encryptLead, decryptLead } from '@/lib/client-crypto'
import {
  isValidEmail,
  isValidParaguayanDocumentId,
  isValidPhone,
  sanitizePhoneInput,
} from '@/lib/validation'
import {
  X,
  User,
  Mail,
  Phone,
  Building2,
  Save,
  Fingerprint,
} from 'lucide-react'

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
  const { data: session } = useSession()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Obtener reactivamente todas las empresas locales disponibles
  const companies = useLiveQuery(
    async () => {
      // Filtrar sólo las que no están eliminadas soft-deleted
      return await localDb.companies.filter((c) => c.deleted !== true).toArray()
    },
    [userId],
    [],
  )

  useEffect(() => {
    if (leadToEdit) {
      setFirstName(leadToEdit.firstName)
      setLastName(leadToEdit.lastName)
      setEmail(leadToEdit.email)
      setPhone(leadToEdit.phone || '')
      setDocumentId(leadToEdit.documentId || '')
      setCompanyId(leadToEdit.companyId || '')
    } else {
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setDocumentId('')
      setCompanyId('')
    }
    setError(null)
  }, [leadToEdit, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !documentId.trim()
    ) {
      setError(
        'El nombre, apellido, correo electrónico y cédula/DNI son obligatorios.',
      )
      setLoading(false)
      return
    }

    if (!isValidEmail(email)) {
      setError('El correo electrónico no tiene un formato válido.')
      setLoading(false)
      return
    }

    if (!isValidPhone(phone)) {
      setError(
        'El número de teléfono no es válido. Ingresalo con código de país (ej. +54 9 11 1234-5678) o, si es de Paraguay, sin código (ej. 0981 123456).',
      )
      setLoading(false)
      return
    }

    if (!isValidParaguayanDocumentId(documentId)) {
      setError(
        'La cédula/DNI no es válida. Debe tener entre 5 y 9 dígitos, solo números.',
      )
      setLoading(false)
      return
    }

    try {
      const dbEncryptionKey = session?.user?.dbEncryptionKey

      // Validar si ya existe un lead local activo con el mismo correo electrónico (desencriptado en memoria)
      const allLocalLeads = await localDb.leads
        .filter((l) => l.userId === userId && l.deleted !== true)
        .toArray()

      const decryptedLeads = await Promise.all(
        allLocalLeads.map((l) => decryptLead(l, dbEncryptionKey))
      )

      const existing = decryptedLeads.find(
        (l) => l.email.toLowerCase() === email.trim().toLowerCase()
      )

      if (
        existing &&
        (!leadToEdit ||
          (leadToEdit.tempId !== existing.tempId &&
            leadToEdit.id !== existing.id))
      ) {
        setError(
          'Ya existe un contacto activo con este correo electrónico en tu base de datos.',
        )
        setLoading(false)
        return
      }

      // Validar si ya existe un lead local activo con el mismo número de documento (desencriptado en memoria)
      if (documentId.trim()) {
        const existingDoc = decryptedLeads.find(
          (l) => l.documentId && l.documentId.toLowerCase() === documentId.trim().toLowerCase()
        )

        if (
          existingDoc &&
          (!leadToEdit ||
            (leadToEdit.tempId !== existingDoc.tempId &&
              leadToEdit.id !== existingDoc.id))
        ) {
          setError(
            'Ya existe un contacto activo con este número de identificación en tu base de datos.',
          )
          setLoading(false)
          return
        }
      }

      const now = Date.now()
      const resolvedCompanyId = companyId || undefined

      if (leadToEdit) {
        // Modo Edición: Encriptamos todo el registro y usamos put
        const fullUpdatedLead: LocalLead = {
          ...leadToEdit,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          documentId: documentId.trim() || undefined,
          companyId: resolvedCompanyId,
          synced: false, // Forzar resincronización
          updatedAt: now,
        }

        const encryptedLead = await encryptLead(fullUpdatedLead, dbEncryptionKey)
        await localDb.leads.put(encryptedLead)
      } else {
        // Modo Creación: Encriptamos todo el registro y usamos add
        const newLead: LocalLead = {
          tempId: crypto.randomUUID(),
          userId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          documentId: documentId.trim() || undefined,
          companyId: resolvedCompanyId,
          synced: false,
          createdAt: now,
          updatedAt: now,
        }

        const encryptedNewLead = await encryptLead(newLead, dbEncryptionKey)
        await localDb.leads.add(encryptedNewLead)
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
      {/* Backdrop: sin onClick a propósito — cerrar el modal acá borraría todo
          lo tipeado en el formulario ante un clic accidental. Cerrar
          requiere el botón X o "Cancelar", ambos explícitos. */}
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="animate-in fade-in zoom-in-95 relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl duration-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <User className="h-5 w-5 text-primary" />
            {leadToEdit ? 'Editar Contacto / Lead' : 'Nuevo Contacto / Lead'}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
                Nombre *
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4.5 w-4.5 text-ink-3" />
                </div>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan"
                  className="block w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
                Apellido *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                className="block w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Correo Electrónico *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-4.5 w-4.5 text-ink-3" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan.perez@email.com"
                className="block w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Teléfono (Opcional)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Phone className="h-4.5 w-4.5 text-ink-3" />
              </div>
              <input
                type="text"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                placeholder="0981 123456"
                maxLength={20}
                className="block w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Cédula / DNI *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Fingerprint className="h-4.5 w-4.5 text-ink-3" />
              </div>
              <input
                type="text"
                inputMode="numeric"
                required
                value={documentId}
                onChange={(e) =>
                  setDocumentId(e.target.value.replace(/\D/g, ''))
                }
                placeholder="1234567"
                maxLength={9}
                className="block w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-2">
              Empresa Asociada
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building2 className="h-4.5 w-4.5 text-ink-3" />
              </div>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-ink-3 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="" className="bg-surface">
                  Ninguna empresa asociada
                </option>
                {companies &&
                  companies.map((comp) => (
                    <option
                      key={comp.id || comp.tempId}
                      value={comp.id || comp.tempId}
                      className="bg-surface"
                    >
                      {`${comp.name} ${comp.synced ? '(Sincronizada)' : '(Local)'}`}
                    </option>
                  ))}
              </select>
              {/* Flecha personalizada */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-3">
                ▼
              </div>
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
              {leadToEdit ? 'Guardar Cambios' : 'Crear Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
