'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ShieldAlert,
  Calendar,
  Clock,
  Send,
  Plus,
  Cloud,
  Database,
  Trash2,
  Bell,
  CheckSquare,
  Phone,
  Mail,
  MessageCircle,
  MessageSquare,
} from 'lucide-react'
import { localDb, LocalLead, LocalActivity, LocalDeal, LocalInvoice } from '@/lib/db'
import { sendWhatsAppMessage } from '@/app/actions/whatsapp'
import { useSession } from 'next-auth/react'
import { encryptActivity } from '@/lib/client-crypto'
import { getActivityTypeConfig, getScoringBadge, getDealStepStyle } from '@/lib/theme/status'
import { formatGs } from '@/lib/format'
import { toast } from 'sonner'
import { useConfirm } from '@/hooks/useConfirm'

// Helper para obtener la fecha de mañana en formato YYYY-MM-DD
const getTomorrowString = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface WhatsAppTemplate {
  name: string
  label: string
  language: string
  text: string
  placeholders: string[]
}

interface LeadDrawerProps {
  selectedLeadForInvoice: LocalLead
  setSelectedLeadForInvoice: (lead: LocalLead | null) => void
  userId: string | undefined
  invoices: LocalInvoice[]
  activities: LocalActivity[]
  deals: LocalDeal[]
  nowTime: number
  getWhatsAppWindowStatus: (lead: LocalLead) => { active: boolean; text: string } | null
  whatsappTemplates: WhatsAppTemplate[]
  isLoadingForeign?: boolean
  highlightedActivityId: string | null
  setHighlightedActivityId: (id: string | null) => void
}

export default function LeadDrawer({
  selectedLeadForInvoice,
  setSelectedLeadForInvoice,
  userId,
  invoices,
  activities,
  deals,
  nowTime,
  getWhatsAppWindowStatus,
  whatsappTemplates,
  isLoadingForeign = false,
  highlightedActivityId,
  setHighlightedActivityId,
}: LeadDrawerProps) {
  const { data: session } = useSession()
  const isForeign = selectedLeadForInvoice.userId !== userId
  const selectedLeadId = selectedLeadForInvoice.id || selectedLeadForInvoice.tempId
  const { confirm, ConfirmDialogElement } = useConfirm()

  // Estado de Navegación del Drawer
  const [activeTab, setActiveTab] = useState<'finance' | 'activities' | 'reminders' | 'deals'>('activities')

  // Recordatorios activos (#16): actividades con reminderDate definido y
  // estado 'active' (ni leídas/en espera ni realizadas) -- se usan para el
  // badge de la pestaña "Recordatorios". Compatibilidad con registros viejos
  // que solo tienen reminderRead (booleano).
  const activeReminderCount = activities.filter((act) => {
    if (!act.reminderDate) return false
    const status = act.reminderStatus || (act.reminderRead ? 'waiting' : 'active')
    return status === 'active'
  }).length

  // Estado del Formulario de Actividad
  const [activityType, setActivityType] = useState<'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'WHATSAPP'>('NOTE')
  const [activityTitle, setActivityTitle] = useState('')
  const [activityBody, setActivityBody] = useState('')
  const [reminderDateOnly, setReminderDateOnly] = useState('')
  const [reminderTimeOnly, setReminderTimeOnly] = useState('08:00')
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false)

  // Estado del Formulario de Nuevo Préstamo (Deal)
  const [dealAmount, setDealAmount] = useState('')
  const [dealTermMonths, setDealTermMonths] = useState('12')
  const [dealInterestRate, setDealInterestRate] = useState('15')
  const [dealNotes, setDealNotes] = useState('')
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false)

  // Estado del Formulario de Nuevo Recordatorio (#16 -- autónomo de la
  // pestaña "Actividades"; crea directamente una Task con reminderDate, sin
  // necesidad de la Nota acompañante que sí tiene sentido en Actividades).
  const [newReminderTitle, setNewReminderTitle] = useState('')
  const [newReminderBody, setNewReminderBody] = useState('')
  const [newReminderDateOnly, setNewReminderDateOnly] = useState(getTomorrowString())
  const [newReminderTimeOnly, setNewReminderTimeOnly] = useState('08:00')
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false)

  // Aviso de cambios sin guardar (#17): el título/cuerpo de "Registrar
  // Actividad" (incluyendo el recordatorio, si está activado), el nuevo
  // formulario de "Recordatorios" y el monto/notas de "Nueva Solicitud de
  // Préstamo" persisten en este estado sin importar qué pestaña esté
  // visible — si hay contenido sin enviar, se confirma antes de cerrar el
  // drawer o cambiar de pestaña.
  const hasUnsavedChanges =
    activityTitle.trim() !== '' ||
    activityBody.trim() !== '' ||
    showReminderPicker ||
    reminderDateOnly.trim() !== '' ||
    newReminderTitle.trim() !== '' ||
    newReminderBody.trim() !== '' ||
    dealAmount.trim() !== '' ||
    dealNotes.trim() !== ''

  const confirmDiscardIfDirty = async () => {
    if (!hasUnsavedChanges) return true
    const ok = await confirm({
      title: 'Cambios sin guardar',
      message:
        'Tenés cambios sin guardar en el formulario de Actividad o de Solicitud de Préstamo. ¿Salir sin guardar?',
      confirmLabel: 'Salir sin guardar',
      variant: 'danger',
    })
    if (ok) {
      // Descartar de verdad lo tipeado -- si no, hasUnsavedChanges sigue en
      // true para siempre y vuelve a preguntar en cualquier pestaña, aunque
      // no se haya tocado nada después de confirmar la salida.
      setActivityTitle('')
      setActivityBody('')
      setShowReminderPicker(false)
      setReminderDateOnly('')
      setReminderTimeOnly('08:00')
      setNewReminderTitle('')
      setNewReminderBody('')
      setNewReminderDateOnly(getTomorrowString())
      setNewReminderTimeOnly('08:00')
      setDealAmount('')
      setDealNotes('')
    }
    return ok
  }

  // WhatsApp Templates local state
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [placeholderValues, setPlaceholderValues] = useState<string[]>([])

  const dateInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  // Resolver la plantilla activa
  const activeTemplate = whatsappTemplates.find((t) => t.name === selectedTemplateName) ||
    whatsappTemplates[0] || { name: '', label: '', language: 'es', text: '', placeholders: [] }

  // Al cambiar el lead seleccionado o las plantillas, reiniciar selecciones de WhatsApp
  useEffect(() => {
    if (whatsappTemplates.length > 0) {
      const firstTmpl = whatsappTemplates[0]
      setSelectedTemplateName(firstTmpl.name)
      const initialPlaceholders = firstTmpl.placeholders.map((_, idx) =>
        idx === 0 ? `${selectedLeadForInvoice.firstName} ${selectedLeadForInvoice.lastName}` : ''
      )
      setPlaceholderValues(initialPlaceholders)
    } else {
      setSelectedTemplateName('')
      setPlaceholderValues([])
    }
  }, [selectedLeadForInvoice, whatsappTemplates])

  // Al cambiar la plantilla seleccionada, resetear/prellenar placeholders
  useEffect(() => {
    const tmpl = whatsappTemplates.find((t) => t.name === selectedTemplateName)
    if (tmpl) {
      const initialPlaceholders = tmpl.placeholders.map((_, idx) =>
        idx === 0 ? `${selectedLeadForInvoice.firstName} ${selectedLeadForInvoice.lastName}` : ''
      )
      setPlaceholderValues(initialPlaceholders)
    } else {
      setPlaceholderValues([])
    }
  }, [selectedTemplateName, whatsappTemplates, selectedLeadForInvoice])

  // Lógica del Highlight de actividad reactivo a la prop -- si la actividad
  // resaltada es un recordatorio (viene de la campanita de notificaciones),
  // hay que abrir la pestaña "Recordatorios", no "Actividades" (#16 la
  // separó a su propia pestaña).
  useEffect(() => {
    if (highlightedActivityId) {
      const highlighted = activities.find(
        (a) => a.id === highlightedActivityId || a.tempId === highlightedActivityId,
      )
      setActiveTab(highlighted?.reminderDate ? 'reminders' : 'activities')

      const timer = setTimeout(() => {
        const element = document.getElementById(`activity-${highlightedActivityId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [highlightedActivityId, activities])

  // Calcular si la ventana de WhatsApp está activa desde el último mensaje recibido
  const wsIncoming = [...(activities || [])]
    .filter((act) => act.type === 'WHATSAPP' && act.title === 'WhatsApp Recibido')
    .sort((a, b) => b.timestamp - a.timestamp)[0]

  let wsActive = false
  let wsText = 'Ventana Cerrada (Requiere plantilla para iniciar)'

  if (wsIncoming) {
    const timeElapsed = nowTime - wsIncoming.timestamp
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (timeElapsed < twentyFourHours) {
      wsActive = true
      const timeLeft = twentyFourHours - timeElapsed
      const hoursLeft = Math.floor(timeLeft / (3600 * 1000))
      const minutesLeft = Math.floor((timeLeft % (3600 * 1000)) / 60000)
      wsText = `Chat Libre Activo (Quedan ${hoursLeft}h ${minutesLeft}m)`
    } else {
      const hoursAgo = Math.floor(timeElapsed / (3600 * 1000))
      wsText = `Ventana Cerrada (Expiró hace ${hoursAgo - 24}h. Requiere plantilla)`
    }
  }

  // Métricas Financieras
  const totalInvoicesAmount = invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0
  const totalBalanceDue = invoices?.reduce((sum, inv) => sum + (inv.balanceDue ?? (inv.status === 'PAID' ? 0 : inv.amount)), 0) || 0
  const paidInvoices = invoices?.filter((inv) => inv.status === 'PAID') || []
  const overdueInvoices = invoices?.filter((inv) => inv.status === 'OVERDUE') || []
  const paymentRatio = invoices && invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 100

  const renderScoringBadge = (scoring?: string) => {
    const { label, style } = getScoringBadge(scoring, 'full')
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${style}`}>{label}</span>
  }

  // Registrar una actividad
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !selectedLeadId || isForeign) return

    let bodyVal = activityBody.trim()

    if ((activityType as string) === 'WHATSAPP') {
      if (!wsActive) {
        let filledText = activeTemplate.text
        activeTemplate.placeholders.forEach((ph, idx) => {
          const val = placeholderValues[idx] || ''
          filledText = filledText.replace(`{{${idx + 1}}}`, val)
        })
        bodyVal = filledText
      }
    }

    // El título es opcional (excepto WhatsApp, que ya tiene uno fijo): si se
    // deja vacío, se deriva de los primeros ~50 caracteres de la descripción.
    const derivedTitle =
      bodyVal.length > 50 ? `${bodyVal.slice(0, 50).trim()}…` : bodyVal
    const titleVal =
      (activityType as string) === 'WHATSAPP'
        ? 'Mensaje de WhatsApp'
        : activityTitle.trim() || derivedTitle

    if (!titleVal || !bodyVal) return

    setIsSubmittingActivity(true)
    try {
      const now = Date.now()
      const dbKey = session?.user?.dbEncryptionKey

      if ((activityType as string) === 'WHATSAPP') {
        let result
        if (wsActive) {
          result = await sendWhatsAppMessage(selectedLeadId, bodyVal)
        } else {
          result = await sendWhatsAppMessage(selectedLeadId, bodyVal, {
            templateName: activeTemplate.name,
            language: activeTemplate.language,
            placeholders: placeholderValues,
          })
        }

        if (!result.success) {
          toast.error('Error al enviar WhatsApp', { description: result.error })
          setIsSubmittingActivity(false)
          return
        }

        if (result.activity) {
          const localAct: LocalActivity = {
            id: result.activity.id,
            tempId: result.activity.tempId,
            leadId: result.activity.leadId,
            userId: result.activity.userId,
            type: 'WHATSAPP',
            title: result.activity.title,
            body: result.activity.body,
            timestamp: result.activity.timestamp,
            synced: false,
            createdAt: now,
            updatedAt: now,
          }
          const encryptedAct = await encryptActivity(localAct, dbKey)
          await localDb.activities.put(encryptedAct)
        }

        setActivityBody('')
        setIsSubmittingActivity(false)
        return
      }

      let reminderTimestamp: number | undefined = undefined
      if (showReminderPicker && reminderDateOnly) {
        const timeVal = reminderTimeOnly || '08:00'
        const datetimeStr = `${reminderDateOnly}T${timeVal}`
        const parsedDate = new Date(datetimeStr)
        if (!isNaN(parsedDate.getTime())) {
          reminderTimestamp = parsedDate.getTime()
        }
      }

      // Si se define un recordatorio y la actividad no es ya una Tarea,
      // se registra por separado como una Task acompañante (para que se
      // sincronice como Task en el CRM), dejando la actividad principal
      // sin recordatorio propio.
      const needsCompanionTask =
        reminderTimestamp !== undefined && activityType !== 'TASK'

      const newMainAct: LocalActivity = {
        tempId: crypto.randomUUID(),
        leadId: selectedLeadId,
        userId,
        type: activityType,
        title: titleVal,
        body: bodyVal,
        timestamp: now,
        reminderDate: needsCompanionTask ? undefined : reminderTimestamp,
        reminderRead: false,
        synced: false,
        createdAt: now,
        updatedAt: now,
      }

      const encryptedMainAct = await encryptActivity(newMainAct, dbKey)
      await localDb.activities.put(encryptedMainAct)

      if (needsCompanionTask) {
        const newTaskAct: LocalActivity = {
          tempId: crypto.randomUUID(),
          leadId: selectedLeadId,
          userId,
          type: 'TASK',
          title: titleVal,
          body: bodyVal,
          timestamp: now,
          reminderDate: reminderTimestamp,
          reminderRead: false,
          reminderStatus: 'active',
          reminderPriority: 'MEDIUM',
          synced: false,
          createdAt: now,
          updatedAt: now,
        }
        const encryptedTaskAct = await encryptActivity(newTaskAct, dbKey)
        await localDb.activities.put(encryptedTaskAct)
      }

      setActivityTitle('')
      setActivityBody('')
      setActivityType('NOTE')
      setShowReminderPicker(false)
      setReminderDateOnly('')
      setReminderTimeOnly('08:00')
    } catch (err) {
      console.error('[Drawer] Error al registrar actividad:', err)
    } finally {
      setIsSubmittingActivity(false)
    }
  }

  // Eliminar actividad
  const handleDeleteActivity = async (act: LocalActivity) => {
    if (isForeign) return
    const ok = await confirm({
      title: 'Eliminar actividad',
      message: '¿Estás seguro de que deseas eliminar esta actividad?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      if (act.id) {
        await localDb.activities.where('id').equals(act.id).modify({ deleted: true, synced: false })
      } else if (act.tempId) {
        await localDb.activities.where('tempId').equals(act.tempId).delete()
      }
    } catch (err) {
      console.error('[Drawer] Error al eliminar actividad:', err)
    }
  }

  // Marcar recordatorio leído/en espera -- sincroniza como Task 'WAITING' en
  // el CRM (antes se sincronizaba como 'COMPLETED', perdiendo la distinción
  // con "Realizado").
  const handleMarkReminderAsRead = async (act: LocalActivity) => {
    if (isForeign) return
    try {
      const patch = { reminderRead: true, reminderStatus: 'waiting' as const, synced: false }
      if (act.id) {
        await localDb.activities.where('id').equals(act.id).modify(patch)
      } else if (act.tempId) {
        await localDb.activities.where('tempId').equals(act.tempId).modify(patch)
      }
    } catch (err) {
      console.error('[Drawer] Error al marcar recordatorio como leído:', err)
    }
  }

  // Marcar recordatorio como Realizado -- sincroniza como Task 'COMPLETED'
  // en el CRM. Reemplaza al viejo "Quitar Alarma", que borraba la Task por
  // completo del CRM y perdía el historial; ahora la Task se conserva,
  // solo cambia de estado.
  const handleCompleteReminder = async (act: LocalActivity) => {
    if (isForeign) return
    const ok = await confirm({
      title: 'Marcar como realizado',
      message: '¿Confirmás que este recordatorio ya fue atendido?',
    })
    if (!ok) return
    try {
      const patch = {
        reminderRead: true,
        reminderStatus: 'completed' as const,
        synced: false,
      }
      if (act.id) {
        await localDb.activities.where('id').equals(act.id).modify(patch)
      } else if (act.tempId) {
        await localDb.activities.where('tempId').equals(act.tempId).modify(patch)
      }
    } catch (err) {
      console.error('[Drawer] Error al marcar el recordatorio como realizado:', err)
    }
  }

  // Registrar un préstamo
  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !selectedLeadId || isForeign) return
    if (!dealAmount.trim()) return

    setIsSubmittingDeal(true)
    try {
      const now = Date.now()
      const amountVal = parseFloat(dealAmount)
      const termVal = parseInt(dealTermMonths)
      // dealInterestRate se tipea con "," como separador decimal (convención
      // local); se normaliza a "." solo acá, para parsear — lo que se guarda
      // en Dexie/Mongo/CRM es el número normal, sin cambios.
      const rateVal = parseFloat(dealInterestRate.replace(',', '.'))

      if (isNaN(amountVal) || amountVal <= 0) {
        toast.error('Por favor ingresa un monto válido.')
        return
      }

      const newDeal: LocalDeal = {
        tempId: crypto.randomUUID(),
        leadId: selectedLeadId,
        userId,
        name: `Préstamo ${selectedLeadForInvoice.firstName} ${selectedLeadForInvoice.lastName}`,
        amount: amountVal,
        termMonths: termVal,
        interestRate: rateVal,
        stage: 'draft',
        notes: dealNotes.trim() || undefined,
        synced: false,
        createdAt: now,
        updatedAt: now,
      }

      await localDb.deals.put(newDeal)

      setDealAmount('')
      setDealTermMonths('12')
      setDealInterestRate('15')
      setDealNotes('')
    } catch (err) {
      console.error('[Drawer] Error al registrar préstamo:', err)
    } finally {
      setIsSubmittingDeal(false)
    }
  }

  // Registrar un recordatorio directamente desde la pestaña "Recordatorios"
  // (#16): se crea como una única Task con reminderDate -- a diferencia del
  // formulario de "Actividades", no hace falta la Nota acompañante porque
  // acá no hay una nota principal de la que "colgar" el recordatorio.
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !selectedLeadId || isForeign) return
    if (!newReminderBody.trim()) return
    if (!newReminderDateOnly) {
      toast.error('Por favor elegí una fecha para el recordatorio.')
      return
    }

    setIsSubmittingReminder(true)
    try {
      const now = Date.now()
      const dbKey = session?.user?.dbEncryptionKey
      const timeVal = newReminderTimeOnly || '08:00'
      const parsedDate = new Date(`${newReminderDateOnly}T${timeVal}`)

      if (isNaN(parsedDate.getTime())) {
        toast.error('La fecha/hora del recordatorio no es válida.')
        return
      }

      // El título es opcional, igual que en "Registrar Actividad" (#3): si se
      // deja vacío, se deriva de los primeros ~50 caracteres de la
      // descripción.
      const trimmedBody = newReminderBody.trim()
      const derivedTitle =
        trimmedBody.length > 50 ? `${trimmedBody.slice(0, 50).trim()}…` : trimmedBody
      const titleVal = newReminderTitle.trim() || derivedTitle

      const newReminder: LocalActivity = {
        tempId: crypto.randomUUID(),
        leadId: selectedLeadId,
        userId,
        type: 'TASK',
        title: titleVal,
        body: trimmedBody,
        timestamp: now,
        reminderDate: parsedDate.getTime(),
        reminderRead: false,
        reminderStatus: 'active',
        reminderPriority: 'MEDIUM',
        synced: false,
        createdAt: now,
        updatedAt: now,
      }

      const encryptedReminder = await encryptActivity(newReminder, dbKey)
      await localDb.activities.put(encryptedReminder)

      setNewReminderTitle('')
      setNewReminderBody('')
      setNewReminderDateOnly(getTomorrowString())
      setNewReminderTimeOnly('08:00')
      toast.success('Recordatorio creado correctamente.')
    } catch (err) {
      console.error('[Drawer] Error al registrar recordatorio:', err)
      toast.error('Ocurrió un error al guardar el recordatorio.')
    } finally {
      setIsSubmittingReminder(false)
    }
  }

  // Eliminar préstamo
  const handleDeleteDeal = async (deal: LocalDeal) => {
    if (isForeign) return
    const ok = await confirm({
      title: 'Eliminar préstamo',
      message: '¿Estás seguro de que deseas eliminar este préstamo?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      if (deal.id) {
        await localDb.deals.where('id').equals(deal.id).modify({ deleted: true, synced: false })
      } else if (deal.tempId) {
        await localDb.deals.where('tempId').equals(deal.tempId).delete()
      }
    } catch (err) {
      console.error('[Drawer] Error al eliminar préstamo:', err)
    }
  }

  return (
    <>
      {ConfirmDialogElement}
      {/* Backdrop overlay */}
      <div
        onClick={async () => {
          if (await confirmDiscardIfDirty()) setSelectedLeadForInvoice(null)
        }}
        className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm transition-opacity duration-300"
      />
      {/* Ancho responsive: se mantiene a pantalla completa en mobile (w-full
          por debajo de max-w-md ya cubre eso), pero en desktop se ensancha
          progresivamente -- con 4 pestañas (Finanzas/Actividades/
          Recordatorios/Préstamos) el ancho angosto original las apretaba. */}
      <div className="animate-slide-in fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl sm:max-w-xl lg:max-w-2xl">
        {/* Cabecera del Drawer */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-primary">
              Detalle del Contacto
            </span>
            <h3 className="mt-1 text-lg font-bold text-ink">
              {selectedLeadForInvoice.firstName} {selectedLeadForInvoice.lastName}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-ink-3">
              {selectedLeadForInvoice.email}
            </p>
            {selectedLeadForInvoice.documentId && (
              <p className="mt-0.5 font-mono text-xs text-ink-2">
                DNI/Cédula: {selectedLeadForInvoice.documentId}
              </p>
            )}
          </div>
          <button
            onClick={async () => {
              if (await confirmDiscardIfDirty()) setSelectedLeadForInvoice(null)
            }}
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isForeign && (
          <div className="flex items-center gap-2 border-b border-warn-bd bg-warn-bg px-6 py-2.5 text-xs text-warn">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-warn" />
            <span>Contacto de otro asesor. Modo Solo Lectura habilitado.</span>
          </div>
        )}

        {/* Selectores de Pestaña */}
        <div className="flex border-b border-border bg-surface-2/50 px-6">
          <button
            onClick={async () => {
              if (activeTab !== 'finance' && (await confirmDiscardIfDirty()))
                setActiveTab('finance')
            }}
            className={`flex-1 border-b-2 px-1 py-3 text-center text-[10px] font-bold uppercase tracking-tight transition-all sm:text-xs sm:tracking-wider ${
              activeTab === 'finance'
                ? 'border-primary text-ink'
                : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            Finanzas
          </button>
          <button
            onClick={async () => {
              if (activeTab !== 'activities' && (await confirmDiscardIfDirty()))
                setActiveTab('activities')
            }}
            className={`flex-1 border-b-2 px-1 py-3 text-center text-[10px] font-bold uppercase tracking-tight transition-all sm:text-xs sm:tracking-wider ${
              activeTab === 'activities'
                ? 'border-primary text-ink'
                : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            Actividades
          </button>
          <button
            onClick={async () => {
              if (activeTab !== 'reminders' && (await confirmDiscardIfDirty()))
                setActiveTab('reminders')
            }}
            className={`flex-1 border-b-2 px-1 py-3 text-center text-[10px] font-bold uppercase tracking-tight transition-all sm:text-xs sm:tracking-wider ${
              activeTab === 'reminders'
                ? 'border-primary text-ink'
                : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            Recordatorios
            {activeReminderCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bad-bg px-1 text-[9px] font-bold text-bad">
                {activeReminderCount}
              </span>
            )}
          </button>
          <button
            onClick={async () => {
              if (activeTab !== 'deals' && (await confirmDiscardIfDirty()))
                setActiveTab('deals')
            }}
            className={`flex-1 border-b-2 px-1 py-3 text-center text-[10px] font-bold uppercase tracking-tight transition-all sm:text-xs sm:tracking-wider ${
              activeTab === 'deals'
                ? 'border-primary text-ink'
                : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            Préstamos
          </button>
        </div>

        {/* Contenido del Drawer */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingForeign ? (
            <div className="flex h-64 flex-col items-center justify-center text-ink-3">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="animate-pulse text-xs">
                Cargando detalles desde el servidor...
              </p>
            </div>
          ) : activeTab === 'finance' ? (
            <div className="space-y-6">
              {/* Sección: Resumen de Score */}
              <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-2">
                    Scoring Crediticio
                  </span>
                  {renderScoringBadge(selectedLeadForInvoice.scoring)}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border-2 pt-2">
                  <div>
                    <span className="block text-[9px] uppercase text-ink-3">
                      Total Adeudado
                    </span>
                    <span className="text-bad mt-0.5 block truncate text-xs font-bold">
                      {formatGs(totalBalanceDue)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ink-3">
                      Cumplimiento
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-ok">
                      {paymentRatio}%
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ink-3">
                      Facturas
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-ink">
                      {invoices?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alertas de Vencimiento */}
              {overdueInvoices.length > 0 && (
                <div className="flex gap-3 rounded-xl border border-bad-bd bg-bad-bg p-4 text-xs text-bad">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-bad" />
                  <div>
                    <span className="block font-bold">¡Facturas Vencidas!</span>
                    <span>
                      Este lead posee {overdueInvoices.length} factura(s) vencida(s) en HubSpot. Riesgo crediticio activo.
                    </span>
                  </div>
                </div>
              )}

              {/* Listado de Facturas */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Detalle de Facturas
                </h4>
                <div className="space-y-3">
                  {invoices && invoices.length > 0 ? (
                    invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-start justify-between rounded-xl border border-border-2 bg-surface p-4"
                      >
                        <div className="space-y-1.5">
                          <span className="block font-mono text-[10px] text-ink-3">
                            INV-ID: {inv.crmId?.slice(-6) || 'LOCAL'}
                          </span>
                          <span className="block text-sm font-bold text-ink">
                            {formatGs(inv.amount)}
                          </span>
                          {inv.status !== 'PAID' && inv.balanceDue !== undefined && inv.balanceDue !== inv.amount && (
                            <span className="block text-[10px] font-semibold text-bad">
                              Pendiente: {formatGs(inv.balanceDue)}
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-ink-3">
                            <Calendar className="h-3 w-3" />
                            <span>Vencimiento: {new Date(inv.dueDate).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          {inv.status === 'PAID' && (
                            <span className="inline-flex items-center rounded border border-ok-bd bg-ok-bg px-2 py-0.5 text-[10px] font-bold text-ok">
                              Pagado
                            </span>
                          )}
                          {inv.status === 'PENDING' && (
                            <span className="inline-flex items-center rounded border border-warn-bd bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn">
                              Pendiente
                            </span>
                          )}
                          {inv.status === 'OVERDUE' && (
                            <span className="inline-flex items-center rounded border border-bad-bd bg-bad-bg px-2 py-0.5 text-[10px] font-bold text-bad">
                              Vencido
                            </span>
                          )}
                          {inv.paymentDate && (
                            <p className="mt-1 text-[9px] text-ink-3">
                              Pago: {new Date(inv.paymentDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-6 text-center text-xs text-ink-3">
                      No se encontraron facturas asociadas a este contacto.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'activities' ? (
            <div className="space-y-6">
              {/* Formulario de Actividad */}
              {!isForeign ? (
                <form
                  onSubmit={handleAddActivity}
                  className="space-y-4 rounded-xl border border-border bg-surface-2/20 p-4 backdrop-blur-md"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Registrar Actividad
                  </h4>

                  <div className={activityType === 'WHATSAPP' ? 'block' : 'grid grid-cols-2 gap-3'}>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                        Tipo
                      </label>
                      <select
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value as any)}
                        className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                      >
                        <option value="NOTE">Nota</option>
                        <option value="CALL">Llamada</option>
                        <option value="MEETING">Reunión</option>
                        <option value="EMAIL">Correo</option>
                        <option value="TASK">Tarea</option>
                        <option value="WHATSAPP">WhatsApp</option>
                      </select>
                    </div>
                    {activityType !== 'WHATSAPP' && (
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                          Título (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Llamada de seguimiento"
                          value={activityTitle}
                          onChange={(e) => setActivityTitle(e.target.value)}
                          className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {activityType === 'WHATSAPP' ? (
                    <div className="space-y-4">
                      <div className={`rounded-lg p-2.5 text-center text-xs font-semibold border ${
                        wsActive
                          ? 'bg-ok-bg border-ok-bd text-ok'
                          : 'bg-warn-bg border-warn-bd text-warn'
                      }`}>
                        {wsText}
                      </div>

                      {!wsActive ? (
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                              Plantilla Homologada
                            </label>
                            <select
                              value={selectedTemplateName}
                              onChange={(e) => setSelectedTemplateName(e.target.value)}
                              className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                            >
                              {whatsappTemplates.map((tmpl) => (
                                <option key={tmpl.name} value={tmpl.name}>
                                  {tmpl.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {activeTemplate.placeholders.map((ph, idx) => (
                            <div key={idx}>
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-3">
                                Variable {`{{${idx + 1}}}`} ({ph})
                              </label>
                              <input
                                type="text"
                                value={placeholderValues[idx] || ''}
                                onChange={(e) => {
                                  const newVals = [...placeholderValues]
                                  newVals[idx] = e.target.value
                                  setPlaceholderValues(newVals)
                                }}
                                required
                                className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                              />
                            </div>
                          ))}

                          <div className="rounded-lg border border-border bg-surface p-3">
                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-3">
                              Vista Previa del Mensaje (Solo Lectura)
                            </span>
                            <p className="text-xs text-ink-2 whitespace-pre-wrap">
                              {(() => {
                                let preview = activeTemplate.text
                                activeTemplate.placeholders.forEach((ph, idx) => {
                                  const val = placeholderValues[idx] || `{{${idx + 1}}}`
                                  preview = preview.replace(`{{${idx + 1}}}`, val)
                                })
                                return preview
                              })()}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                            Mensaje de WhatsApp (Texto Libre)
                          </label>
                          <textarea
                            placeholder="Escribe un mensaje de WhatsApp libre..."
                            value={activityBody}
                            onChange={(e) => setActivityBody(e.target.value)}
                            required
                            rows={3}
                            className="block w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                          Descripción
                        </label>
                        <textarea
                          placeholder="Escribe el resumen o notas de la actividad..."
                          value={activityBody}
                          onChange={(e) => setActivityBody(e.target.value)}
                          required
                          rows={3}
                          className="block w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="enable-reminder"
                            checked={showReminderPicker}
                            onChange={(e) => {
                              setShowReminderPicker(e.target.checked)
                              if (e.target.checked) {
                                setReminderDateOnly(getTomorrowString())
                                setReminderTimeOnly('08:00')
                              } else {
                                setReminderDateOnly('')
                                setReminderTimeOnly('')
                              }
                            }}
                            className="h-3.5 w-3.5 cursor-pointer rounded border-border bg-surface text-primary focus:ring-primary"
                          />
                          <label
                            htmlFor="enable-reminder"
                            className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-wider text-ink-2"
                          >
                            Programar recordatorio
                          </label>
                        </div>
                        {showReminderPicker && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-ink-3">
                                Fecha
                              </label>
                              <div className="relative">
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => {
                                    if (typeof dateInputRef.current?.showPicker === 'function') {
                                      try { dateInputRef.current.showPicker() } catch (_) {}
                                    }
                                  }}
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 transition-colors hover:text-primary focus:outline-none"
                                >
                                  <Calendar className="h-3.5 w-3.5" />
                                </button>
                                <input
                                  ref={dateInputRef}
                                  type="date"
                                  value={reminderDateOnly}
                                  onChange={(e) => setReminderDateOnly(e.target.value)}
                                  onClick={(e) => {
                                    if (typeof e.currentTarget.showPicker === 'function') {
                                      try { e.currentTarget.showPicker() } catch (_) {}
                                    }
                                  }}
                                  required={showReminderPicker}
                                  className="block w-full cursor-pointer rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-ink-3">
                                Hora
                              </label>
                              <div className="relative">
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => {
                                    if (typeof timeInputRef.current?.showPicker === 'function') {
                                      try { timeInputRef.current.showPicker() } catch (_) {}
                                    }
                                  }}
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 transition-colors hover:text-primary focus:outline-none"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                </button>
                                <input
                                  ref={timeInputRef}
                                  type="time"
                                  value={reminderTimeOnly}
                                  onChange={(e) => setReminderTimeOnly(e.target.value)}
                                  onClick={(e) => {
                                    if (typeof e.currentTarget.showPicker === 'function') {
                                      try { e.currentTarget.showPicker() } catch (_) {}
                                    }
                                  }}
                                  required={showReminderPicker}
                                  className="block w-full cursor-pointer rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingActivity}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      activityType === 'WHATSAPP'
                        ? 'bg-ok text-white hover:bg-accent shadow-lg'
                        : 'bg-cta-bg text-cta-ink hover:bg-accent shadow-lg'
                    }`}
                  >
                    {activityType === 'WHATSAPP' ? (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Enviar WhatsApp
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Registrar Actividad
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-border bg-surface-2/10 p-4 text-center text-xs text-ink-3">
                  No tienes permisos para registrar actividades en este contacto (Modo Solo Lectura).
                </div>
              )}

              {/* Timeline de Actividades */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Historial de Actividades
                </h4>

                <div className="relative ml-3.5 space-y-6 border-l border-border pl-6">
                  {activities && activities.filter((act) => !act.reminderDate).length > 0 ? (
                    [...activities]
                      .filter((act) => !act.reminderDate)
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((act) => {
                        const config = getActivityTypeConfig(act.type)
                        const IconComponent = config.icon
                        const isWhatsApp = act.type === 'WHATSAPP'
                        const isOutgoing = act.title === 'WhatsApp Enviado'

                        // Formateo inteligente de fecha y hora
                        const dateObj = new Date(act.timestamp)
                        const isToday = dateObj.toDateString() === new Date().toDateString()
                        const formattedTime = isToday
                          ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : dateObj.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

                        return (
                          <div key={act.id || act.tempId} className="group relative">
                            {/* Icono en timeline */}
                            <div className={`absolute -left-[38px] top-1.5 rounded-full border p-1 ${
                              isWhatsApp
                                ? isOutgoing
                                  ? 'bg-ok-bg border-ok-bd text-ok'
                                  : 'bg-chip border-chip-bd text-chip-ink'
                                : config.style
                            } shadow-md`}>
                              <IconComponent className="h-3.5 w-3.5" />
                            </div>

                            {isWhatsApp ? (
                              /* Renderizado Estilo WhatsApp Chat Bubble */
                              <div className={`flex w-full ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  id={`activity-${act.id || act.tempId}`}
                                  className={`relative max-w-[85%] rounded-xl px-3 py-2 border transition-all duration-300 ${
                                    isOutgoing
                                      ? 'bg-ok-bg border-ok-bd text-ink rounded-tr-none'
                                      : 'bg-chip border-chip-bd text-ink rounded-tl-none'
                                  } ${
                                    highlightedActivityId === act.id || highlightedActivityId === act.tempId
                                      ? 'ring-2 ring-primary scale-[1.02]'
                                      : ''
                                  }`}
                                >
                                  {/* Mensaje */}
                                  <p className="whitespace-pre-line text-xs leading-relaxed text-ink-2">
                                    {act.body}
                                  </p>

                                  {/* Meta: Hora y Estados */}
                                  <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[9px] text-ink-3">
                                    <span className="font-mono">{formattedTime}</span>

                                    {/* Indicadores de Sincronización y Borrado */}
                                    <div className="flex items-center gap-1 opacity-40 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                      {act.synced ? (
                                        <span title="Sincronizado con HubSpot">
                                          <Cloud className="h-3 w-3 text-ok" />
                                        </span>
                                      ) : (
                                        <span title="Guardado localmente, pendiente de sincronización">
                                          <Database className="h-3 w-3 animate-pulse text-warn" />
                                        </span>
                                      )}

                                      <button
                                        onClick={() => handleDeleteActivity(act)}
                                        className="rounded p-0.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-bad"
                                        title="Eliminar mensaje de WhatsApp"
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Renderizado estándar para otras actividades */
                              <div
                                id={`activity-${act.id || act.tempId}`}
                                className={`space-y-2 rounded-xl border p-4 transition-all duration-500 ${
                                  highlightedActivityId === act.id || highlightedActivityId === act.tempId
                                    ? 'scale-[1.02] border-primary bg-chip ring-2 ring-primary/20'
                                    : 'border-border-2 bg-surface/80'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="block font-mono text-[9px] text-ink-3">
                                      {new Date(act.timestamp).toLocaleString()}
                                    </span>
                                    <h5 className="mt-0.5 text-xs font-bold text-ink">
                                      {act.reminderDate ? `Recordatorio: ${act.title}` : act.title}
                                    </h5>
                                  </div>

                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    {act.synced ? (
                                      <span title="Sincronizado con HubSpot">
                                        <Cloud className="h-3.5 w-3.5 text-ok" />
                                      </span>
                                    ) : (
                                      <span title="Guardado localmente, pendiente de sincronización">
                                        <Database className="h-3.5 w-3.5 animate-pulse text-warn" />
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleDeleteActivity(act)}
                                      className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-bad"
                                      title="Eliminar actividad"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>

                                <p className="whitespace-pre-line text-xs leading-relaxed text-ink-2">
                                  {act.body}
                                </p>
                                {/* Los recordatorios (act.reminderDate) ya no se muestran acá --
                                    esta lista los excluye explícitamente (ver .filter arriba);
                                    tienen su propia pestaña "Recordatorios" (#16). */}
                              </div>
                            )}
                          </div>
                        )
                      })
                  ) : (
                    <p className="-ml-3.5 py-6 text-center text-xs text-ink-3">
                      No se encontraron actividades registradas para este contacto.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'reminders' ? (
            <div className="space-y-6">
              {/* Formulario Nuevo Recordatorio */}
              {!isForeign ? (
                <form
                  onSubmit={handleAddReminder}
                  className="space-y-4 rounded-xl border border-border bg-surface-2/20 p-4 backdrop-blur-md"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Nuevo Recordatorio
                  </h4>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                      Título (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Llamar para renovar contrato"
                      value={newReminderTitle}
                      onChange={(e) => setNewReminderTitle(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                      Descripción
                    </label>
                    <textarea
                      placeholder="Detalle del recordatorio..."
                      value={newReminderBody}
                      onChange={(e) => setNewReminderBody(e.target.value)}
                      required
                      rows={2}
                      className="block w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={newReminderDateOnly}
                        onChange={(e) => setNewReminderDateOnly(e.target.value)}
                        required
                        className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                        Hora
                      </label>
                      <input
                        type="time"
                        value={newReminderTimeOnly}
                        onChange={(e) => setNewReminderTimeOnly(e.target.value)}
                        required
                        className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReminder}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-cta-bg py-2 text-xs font-bold text-cta-ink transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {isSubmittingReminder ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cta-ink border-t-transparent" />
                    ) : (
                      <>
                        <Bell className="h-3.5 w-3.5" />
                        Crear Recordatorio
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-border bg-surface-2/10 p-4 text-center text-xs text-ink-3">
                  No tenes permisos para crear recordatorios para este contacto (Modo Solo Lectura).
                </div>
              )}

              <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                Recordatorios Registrados
              </h4>
              <div className="space-y-3">
                {activities.filter((act) => act.reminderDate).length > 0 ? (
                  [...activities]
                    .filter((act) => act.reminderDate)
                    // Más reciente arriba (por fecha de creación), igual
                    // criterio que la lista de Deals.
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((act) => {
                      // Compatibilidad: registros viejos solo tienen
                      // reminderRead (booleano); reminderStatus es la fuente
                      // de verdad de acá en adelante.
                      const status =
                        act.reminderStatus ||
                        (act.reminderRead ? 'waiting' : 'active')
                      return (
                      <div
                        key={act.id || act.tempId}
                        id={`activity-${act.id || act.tempId}`}
                        className={`space-y-2 rounded-xl border bg-chip p-4 transition-all duration-500 ${
                          highlightedActivityId === act.id || highlightedActivityId === act.tempId
                            ? 'scale-[1.02] border-primary ring-2 ring-primary/20'
                            : 'border-chip-bd'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-chip-ink">
                              <Bell className="h-3.5 w-3.5" />
                              <span className="font-medium">
                                {act.reminderDate &&
                                  new Date(act.reminderDate).toLocaleString()}
                              </span>
                              {status === 'completed' ? (
                                <span className="ml-1 rounded border border-ok-bd bg-ok-bg px-1.5 py-0.5 text-[8px] text-ok">
                                  Realizado
                                </span>
                              ) : status === 'waiting' ? (
                                <span className="ml-1 rounded border border-chip-bd bg-surface px-1.5 py-0.5 text-[8px] text-chip-ink">
                                  Leído
                                </span>
                              ) : (
                                <span className="ml-1 rounded border border-warn-bd bg-warn-bg px-1.5 py-0.5 text-[8px] text-warn">
                                  Activo
                                </span>
                              )}
                            </div>
                            <h5 className="mt-1 text-xs font-bold text-ink">
                              {act.title}
                            </h5>
                          </div>
                          {act.synced ? (
                            <span title="Sincronizado con HubSpot">
                              <Cloud className="h-3.5 w-3.5 shrink-0 text-ok" />
                            </span>
                          ) : (
                            <span title="Guardado localmente, pendiente de sincronización">
                              <Database className="h-3.5 w-3.5 shrink-0 animate-pulse text-warn" />
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-line text-xs leading-relaxed text-ink-2">
                          {act.body}
                        </p>
                        {!isForeign && status !== 'completed' && (
                          <div className="flex items-center gap-2 pt-1">
                            {status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleMarkReminderAsRead(act)}
                                className="flex items-center gap-1 rounded border border-chip-bd bg-surface px-2 py-1 text-[9px] font-bold text-chip-ink transition-colors hover:bg-chip"
                              >
                                <CheckSquare className="h-3 w-3" />
                                Marcar Leído
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCompleteReminder(act)}
                              className="flex items-center gap-1 rounded border border-ok-bd bg-ok-bg px-2 py-1 text-[9px] font-bold text-ok transition-colors hover:bg-ok-bd/40"
                            >
                              <CheckSquare className="h-3 w-3" />
                              Marcar como Realizado
                            </button>
                          </div>
                        )}
                      </div>
                    )})
                ) : (
                  <p className="py-6 text-center text-xs text-ink-3">
                    No hay recordatorios para este contacto.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Formulario Préstamo */}
              {!isForeign ? (
                <form
                  onSubmit={handleAddDeal}
                  className="space-y-4 rounded-xl border border-border bg-surface-2/20 p-4 backdrop-blur-md"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Nueva Solicitud de Préstamo
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                        Monto (Gs.)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej. 5.000.000"
                        // dealAmount guarda solo dígitos (sin separadores); acá se
                        // muestra formateado con separador de miles es-PY, pero lo
                        // que se persiste en Dexie/Mongo/CRM sigue siendo el número
                        // plano — esto es puramente visual, para reducir errores al
                        // tipear montos de 6-7 cifras en guaraníes.
                        value={
                          dealAmount
                            ? Number(dealAmount).toLocaleString('es-PY')
                            : ''
                        }
                        onChange={(e) =>
                          setDealAmount(e.target.value.replace(/\D/g, ''))
                        }
                        required
                        className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                        Plazo (Meses)
                      </label>
                      <select
                        value={dealTermMonths}
                        onChange={(e) => setDealTermMonths(e.target.value)}
                        className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                      >
                        <option value="3">3 meses</option>
                        <option value="6">6 meses</option>
                        <option value="12">12 meses</option>
                        <option value="18">18 meses</option>
                        <option value="24">24 meses</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                      Tasa de Interés (%)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ej. 15,5"
                      // Se tipea con "," como separador decimal (ver conversión a
                      // "." en handleAddDeal antes de guardar). Solo se permiten
                      // dígitos y una coma.
                      value={dealInterestRate}
                      onChange={(e) => {
                        const cleaned = e.target.value
                          // El teclado numérico suele tener solo "." como tecla
                          // decimal (no ","); lo tratamos como equivalente.
                          .replace(/\./g, ',')
                          .replace(/[^0-9,]/g, '')
                          .replace(/(,.*),/g, '$1')
                        setDealInterestRate(cleaned)
                      }}
                      required
                      className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                      Notas / Justificación
                    </label>
                    <textarea
                      placeholder="Escribe comentarios u observaciones del préstamo..."
                      value={dealNotes}
                      onChange={(e) => setDealNotes(e.target.value)}
                      rows={3}
                      className="block w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingDeal}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-cta-bg py-2 text-xs font-semibold text-cta-ink hover:bg-accent disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Enviar Solicitud
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-border bg-surface-2/10 p-4 text-center text-xs text-ink-3">
                  No tienes permisos para solicitar préstamos para este contacto (Modo Solo Lectura).
                </div>
              )}

              {/* Listado Préstamos */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Solicitudes de Préstamos
                </h4>
                <div className="space-y-4">
                  {deals && deals.length > 0 ? (
                    [...deals]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime(),
                      )
                      .map((deal) => {
                      const steps = [
                        { stage: 'draft', label: 'Borrador' },
                        { stage: 'under_evaluation', label: 'Riesgo' },
                        { stage: 'approved', label: 'Aprobado' },
                        { stage: 'disbursed', label: 'Desembolsado' },
                      ]

                      const getStepStatus = (dealStage: string, stepStage: string) => {
                        const stageOrder = ['draft', 'under_evaluation', 'approved', 'disbursed', 'completed']
                        const currentIdx = stageOrder.indexOf(dealStage)
                        const stepIdx = stageOrder.indexOf(stepStage)

                        if (dealStage === 'refused' || dealStage === 'overdue') return 'disabled'
                        if (currentIdx >= 3 && dealStage === 'completed') return 'completed'
                        if (stepIdx < currentIdx) return 'completed'
                        if (stepIdx === currentIdx) return 'active'
                        return 'upcoming'
                      }

                      return (
                        <div key={deal.id || deal.tempId} className="space-y-3 rounded-xl border border-border-2 bg-surface p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="block font-mono text-[10px] text-ink-3">
                                Creado: {new Date(deal.createdAt).toLocaleDateString()}
                              </span>
                              <h5 className="mt-0.5 text-sm font-bold text-ink">
                                {formatGs(deal.amount)}
                              </h5>
                              <p className="mt-0.5 text-[10px] text-ink-2">
                                Plazo: {deal.termMonths} meses | Tasa: {deal.interestRate}%
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {deal.synced ? (
                                <span title="Sincronizado con el CRM">
                                  <Cloud className="h-3.5 w-3.5 text-ok" />
                                </span>
                              ) : (
                                <span title="Pendiente de Sincronización">
                                  <Database className="h-3.5 w-3.5 animate-pulse text-warn" />
                                </span>
                              )}
                              {!isForeign && (
                                <button
                                  onClick={() => handleDeleteDeal(deal)}
                                  className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-bad"
                                  title="Eliminar préstamo"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {deal.notes && (
                            <p className="rounded border border-border-2 bg-surface-2 p-2 font-mono text-xs leading-relaxed text-ink-2">
                              {deal.notes}
                            </p>
                          )}

                          {/* Stepper Horizontal */}
                          {deal.stage !== 'refused' && deal.stage !== 'overdue' && deal.stage !== 'completed' ? (
                            <div className="relative mt-4 flex items-center justify-between px-2 pb-1 pt-2">
                              <div className="absolute left-4 right-4 top-1/2 -z-10 h-0.5 -translate-y-[10px] bg-border" />
                              <div
                                className="absolute left-4 top-1/2 -z-10 h-0.5 -translate-y-[10px] bg-ok transition-all duration-500"
                                style={{
                                  width:
                                    deal.stage === 'draft'
                                      ? '0%'
                                      : deal.stage === 'under_evaluation'
                                        ? '33.33%'
                                        : deal.stage === 'approved'
                                          ? '66.66%'
                                          : '100%',
                                }}
                              />
                              {steps.map((step, idx) => {
                                const status = getStepStatus(deal.stage, step.stage)
                                const stepStyle = getDealStepStyle(status)
                                return (
                                  <div key={step.stage} className="z-10 flex flex-col items-center">
                                    <div
                                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold transition-all ${stepStyle.circle}`}
                                    >
                                      {status === 'completed' ? '✓' : idx + 1}
                                    </div>
                                    <span className={`mt-1.5 text-[8px] font-semibold ${stepStyle.label}`}>
                                      {step.label}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}

                          {deal.stage === 'refused' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-bad-bd bg-bad-bg p-2 text-xs font-semibold text-bad">
                              <ShieldAlert className="h-4 w-4 shrink-0" />
                              <span>Solicitud Rechazada por Riesgos</span>
                            </div>
                          )}

                          {deal.stage === 'overdue' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-bad-bd bg-bad-bg p-2 text-xs font-semibold text-bad">
                              <ShieldAlert className="h-4 w-4 shrink-0" />
                              <span>Crédito en Mora (Vencido)</span>
                            </div>
                          )}

                          {deal.stage === 'completed' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-ok-bd bg-ok-bg p-2 text-xs font-semibold text-ok">
                              <CheckSquare className="h-4 w-4 shrink-0" />
                              <span>Crédito Completado (Pagado)</span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="py-6 text-center text-xs text-ink-3">
                      No se encontraron solicitudes de préstamos registradas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
