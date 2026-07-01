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

  // Estado de Navegación del Drawer
  const [activeTab, setActiveTab] = useState<'finance' | 'activities' | 'deals'>('activities')

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

  // Lógica del Highlight de actividad reactivo a la prop
  useEffect(() => {
    if (highlightedActivityId) {
      setActiveTab('activities')

      const timer = setTimeout(() => {
        const element = document.getElementById(`activity-${highlightedActivityId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [highlightedActivityId])

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

  // Configuración de estilos según tipo de actividad en Timeline
  const getActivityConfig = (type: LocalActivity['type']) => {
    switch (type) {
      case 'CALL':
        return { icon: Phone, bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' }
      case 'MEETING':
        return { icon: Calendar, bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' }
      case 'EMAIL':
        return { icon: Mail, bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' }
      case 'TASK':
        return { icon: CheckSquare, bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' }
      case 'WHATSAPP':
        return { icon: MessageCircle, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' }
      case 'NOTE':
      default:
        return { icon: MessageSquare, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' }
    }
  }

  const getScoringBadge = (scoring?: string) => {
    switch (scoring) {
      case 'A+':
      case 'A':
      case 'B':
        return <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">Score {scoring} (Excelente)</span>
      case 'C':
      case 'D':
        return <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400">Score {scoring} (Riesgo Medio)</span>
      case 'E':
      case 'F':
        return <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">Score {scoring} (Riesgo Alto)</span>
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">Sin Score</span>
    }
  }

  // Registrar una actividad
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !selectedLeadId || isForeign) return

    const titleVal = (activityType as string) === 'WHATSAPP' ? 'Mensaje de WhatsApp' : activityTitle.trim()
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
          alert(`Error al enviar WhatsApp: ${result.error}`)
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

      const newMainAct: LocalActivity = {
        tempId: crypto.randomUUID(),
        leadId: selectedLeadId,
        userId,
        type: activityType,
        title: titleVal,
        body: bodyVal,
        timestamp: now,
        reminderDate: reminderTimestamp,
        reminderRead: false,
        synced: false,
        createdAt: now,
        updatedAt: now,
      }

      const encryptedMainAct = await encryptActivity(newMainAct, dbKey)
      await localDb.activities.put(encryptedMainAct)

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
    if (!confirm('¿Estás seguro de que deseas eliminar esta actividad?')) return
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

  // Marcar recordatorio leído
  const handleMarkReminderAsRead = async (act: LocalActivity) => {
    if (isForeign) return
    try {
      if (act.id) {
        await localDb.activities.where('id').equals(act.id).modify({ reminderRead: true, synced: false })
      } else if (act.tempId) {
        await localDb.activities.where('tempId').equals(act.tempId).modify({ reminderRead: true })
      }
    } catch (err) {
      console.error('[Drawer] Error al marcar recordatorio como leído:', err)
    }
  }

  // Remover alarma
  const handleRemoveReminder = async (act: LocalActivity) => {
    if (isForeign) return
    if (!confirm('¿Estás seguro de que deseas quitar el recordatorio?')) return
    try {
      if (act.id) {
        await localDb.activities.where('id').equals(act.id).modify({ reminderDate: undefined, reminderRead: false, synced: false })
      } else if (act.tempId) {
        await localDb.activities.where('tempId').equals(act.tempId).modify({ reminderDate: undefined, reminderRead: false })
      }
    } catch (err) {
      console.error('[Drawer] Error al quitar el recordatorio:', err)
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
      const rateVal = parseFloat(dealInterestRate)

      if (isNaN(amountVal) || amountVal <= 0) {
        alert('Por favor ingresa un monto válido.')
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

  // Eliminar préstamo
  const handleDeleteDeal = async (deal: LocalDeal) => {
    if (isForeign) return
    if (!confirm('¿Estás seguro de que deseas eliminar este préstamo?')) return
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
      {/* Backdrop overlay */}
      <div
        onClick={() => setSelectedLeadForInvoice(null)}
        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
      />
      <div className="animate-slide-in fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-950/95 shadow-2xl">
        {/* Cabecera del Drawer */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Detalle del Contacto
            </span>
            <h3 className="mt-1 text-lg font-bold text-white">
              {selectedLeadForInvoice.firstName} {selectedLeadForInvoice.lastName}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {selectedLeadForInvoice.email}
            </p>
            {selectedLeadForInvoice.documentId && (
              <p className="mt-0.5 font-mono text-xs text-slate-400">
                DNI/Cédula: {selectedLeadForInvoice.documentId}
              </p>
            )}
          </div>
          <button
            onClick={() => setSelectedLeadForInvoice(null)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isForeign && (
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-6 py-2.5 text-xs text-amber-400">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-amber-400" />
            <span>Contacto de otro asesor. Modo Solo Lectura habilitado.</span>
          </div>
        )}

        {/* Selectores de Pestaña */}
        <div className="flex border-b border-slate-800 bg-slate-900/10 px-6">
          <button
            onClick={() => setActiveTab('finance')}
            className={`flex-1 border-b-2 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'finance'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Finanzas
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`flex-1 border-b-2 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'activities'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Actividades
          </button>
          <button
            onClick={() => setActiveTab('deals')}
            className={`flex-1 border-b-2 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'deals'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Préstamos
          </button>
        </div>

        {/* Contenido del Drawer */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingForeign ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="animate-pulse text-xs">
                Cargando detalles desde el servidor...
              </p>
            </div>
          ) : activeTab === 'finance' ? (
            <div className="space-y-6">
              {/* Sección: Resumen de Score */}
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Scoring Crediticio
                  </span>
                  {getScoringBadge(selectedLeadForInvoice.scoring)}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-800/50 pt-2">
                  <div>
                    <span className="block text-[9px] uppercase text-slate-500">
                      Total Adeudado
                    </span>
                    <span className="text-rose-450 mt-0.5 block truncate text-xs font-bold">
                      ${totalBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-slate-500">
                      Cumplimiento
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-emerald-400">
                      {paymentRatio}%
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-slate-500">
                      Facturas
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-white">
                      {invoices?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alertas de Vencimiento */}
              {overdueInvoices.length > 0 && (
                <div className="flex gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-300">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Detalle de Facturas
                </h4>
                <div className="space-y-3">
                  {invoices && invoices.length > 0 ? (
                    invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-start justify-between rounded-xl border border-slate-900 bg-slate-950 p-4"
                      >
                        <div className="space-y-1.5">
                          <span className="block font-mono text-[10px] text-slate-500">
                            INV-ID: {inv.crmId?.slice(-6) || 'LOCAL'}
                          </span>
                          <span className="block text-sm font-bold text-white">
                            ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                          </span>
                          {inv.status !== 'PAID' && inv.balanceDue !== undefined && inv.balanceDue !== inv.amount && (
                            <span className="text-slate-455 block text-[10px] font-semibold text-rose-400">
                              Pendiente: ${inv.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Calendar className="h-3 w-3" />
                            <span>Vencimiento: {new Date(inv.dueDate).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          {inv.status === 'PAID' && (
                            <span className="inline-flex items-center rounded border border-emerald-500/10 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              Pagado
                            </span>
                          )}
                          {inv.status === 'PENDING' && (
                            <span className="inline-flex items-center rounded border border-amber-500/10 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              Pendiente
                            </span>
                          )}
                          {inv.status === 'OVERDUE' && (
                            <span className="inline-flex items-center rounded border border-rose-500/10 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                              Vencido
                            </span>
                          )}
                          {inv.paymentDate && (
                            <p className="mt-1 text-[9px] text-slate-500">
                              Pago: {new Date(inv.paymentDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-500">
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
                  className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/20 p-4 backdrop-blur-md"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    Registrar Actividad
                  </h4>

                  <div className={activityType === 'WHATSAPP' ? 'block' : 'grid grid-cols-2 gap-3'}>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Tipo
                      </label>
                      <select
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value as any)}
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
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
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Título
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Llamada de seguimiento"
                          value={activityTitle}
                          onChange={(e) => setActivityTitle(e.target.value)}
                          required
                          className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {activityType === 'WHATSAPP' ? (
                    <div className="space-y-4">
                      <div className={`rounded-lg p-2.5 text-center text-xs font-semibold border ${
                        wsActive
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>
                        {wsText}
                      </div>

                      {!wsActive ? (
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Plantilla Homologada
                            </label>
                            <select
                              value={selectedTemplateName}
                              onChange={(e) => setSelectedTemplateName(e.target.value)}
                              className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
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
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                                className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          ))}

                          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                              Vista Previa del Mensaje (Solo Lectura)
                            </span>
                            <p className="text-xs text-slate-300 whitespace-pre-wrap">
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
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Mensaje de WhatsApp (Texto Libre)
                          </label>
                          <textarea
                            placeholder="Escribe un mensaje de WhatsApp libre..."
                            value={activityBody}
                            onChange={(e) => setActivityBody(e.target.value)}
                            required
                            rows={3}
                            className="block w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Descripción
                        </label>
                        <textarea
                          placeholder="Escribe el resumen o notas de la actividad..."
                          value={activityBody}
                          onChange={(e) => setActivityBody(e.target.value)}
                          required
                          rows={3}
                          className="block w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
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
                            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                          />
                          <label
                            htmlFor="enable-reminder"
                            className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-wider text-slate-400"
                          >
                            Programar recordatorio
                          </label>
                        </div>
                        {showReminderPicker && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-slate-500">
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
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-indigo-400 focus:outline-none"
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
                                  className="block w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-slate-500">
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
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-indigo-400 focus:outline-none"
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
                                  className="block w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
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
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                      activityType === 'WHATSAPP'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
                        : 'bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
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
                <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-4 text-center text-xs text-slate-500">
                  No tienes permisos para registrar actividades en este contacto (Modo Solo Lectura).
                </div>
              )}

              {/* Timeline de Actividades */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Historial de Actividades
                </h4>

                <div className="relative ml-3.5 space-y-6 border-l border-slate-800 pl-6">
                  {activities && activities.length > 0 ? (
                    [...activities]
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((act) => {
                        const config = getActivityConfig(act.type)
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
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                : `${config.bg} ${config.border} ${config.text}`
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
                                      ? 'bg-emerald-950/40 border-emerald-500/20 text-slate-100 rounded-tr-none'
                                      : 'bg-slate-900 border-slate-850 text-slate-100 rounded-tl-none'
                                  } ${
                                    highlightedActivityId === act.id || highlightedActivityId === act.tempId
                                      ? 'ring-2 ring-indigo-500 scale-[1.02]'
                                      : ''
                                  }`}
                                >
                                  {/* Mensaje */}
                                  <p className="whitespace-pre-line text-xs leading-relaxed text-slate-300">
                                    {act.body}
                                  </p>

                                  {/* Meta: Hora y Estados */}
                                  <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[9px] text-slate-500">
                                    <span className="font-mono">{formattedTime}</span>

                                    {/* Indicadores de Sincronización y Borrado */}
                                    <div className="flex items-center gap-1 opacity-40 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                      {act.synced ? (
                                        <span title="Sincronizado con HubSpot">
                                          <Cloud className="h-3 w-3 text-emerald-400" />
                                        </span>
                                      ) : (
                                        <span title="Guardado localmente, pendiente de sincronización">
                                          <Database className="h-3 w-3 animate-pulse text-amber-500" />
                                        </span>
                                      )}

                                      <button
                                        onClick={() => handleDeleteActivity(act)}
                                        className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
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
                                    ? 'scale-[1.02] border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20'
                                    : 'border-slate-900 bg-slate-950/80'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="block font-mono text-[9px] text-slate-500">
                                      {new Date(act.timestamp).toLocaleString()}
                                    </span>
                                    <h5 className="mt-0.5 text-xs font-bold text-white">
                                      {act.reminderDate ? `Recordatorio: ${act.title}` : act.title}
                                    </h5>
                                  </div>

                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    {act.synced ? (
                                      <span title="Sincronizado con HubSpot">
                                        <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                                      </span>
                                    ) : (
                                      <span title="Guardado localmente, pendiente de sincronización">
                                        <Database className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleDeleteActivity(act)}
                                      className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-900 hover:text-red-400"
                                      title="Eliminar actividad"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>

                                <p className="whitespace-pre-line text-xs leading-relaxed text-slate-400">
                                  {act.body}
                                </p>

                                {act.reminderDate && (
                                  <div className="mt-2 flex max-w-md flex-col gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-950/40 p-2.5">
                                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-300">
                                      <Bell className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
                                      <span className="font-medium">
                                        Recordatorio: {new Date(act.reminderDate).toLocaleString()}
                                      </span>
                                      {act.reminderRead ? (
                                        <span className="ml-1 rounded border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.5 text-[8px] text-indigo-200">
                                          Leído
                                        </span>
                                      ) : (
                                        <span className="ml-1 rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[8px] text-amber-200">
                                          Activo
                                        </span>
                                      )}
                                    </div>
                                    {!isForeign && (
                                      <div className="flex items-center gap-2">
                                        {!act.reminderRead && (
                                          <button
                                            type="button"
                                            onClick={() => handleMarkReminderAsRead(act)}
                                            className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/20 px-2 py-1 text-[9px] font-bold text-indigo-300 transition-colors hover:bg-indigo-500/30 hover:text-indigo-200"
                                          >
                                            <CheckSquare className="h-3 w-3" />
                                            Marcar Leído
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveReminder(act)}
                                          className="flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-350"
                                        >
                                          <X className="h-3 w-3" />
                                          Quitar Alarma
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                  ) : (
                    <p className="-ml-3.5 py-6 text-center text-xs text-slate-500">
                      No se encontraron actividades registradas para este contacto.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Formulario Préstamo */}
              {!isForeign ? (
                <form
                  onSubmit={handleAddDeal}
                  className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/20 p-4 backdrop-blur-md"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    Nueva Solicitud de Préstamo
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Monto (USD)
                      </label>
                      <input
                        type="number"
                        placeholder="Ej. 5000"
                        value={dealAmount}
                        onChange={(e) => setDealAmount(e.target.value)}
                        required
                        min="1"
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Plazo (Meses)
                      </label>
                      <select
                        value={dealTermMonths}
                        onChange={(e) => setDealTermMonths(e.target.value)}
                        className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
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
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tasa de Interés (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ej. 15"
                      value={dealInterestRate}
                      onChange={(e) => setDealInterestRate(e.target.value)}
                      required
                      min="0"
                      className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Notas / Justificación
                    </label>
                    <textarea
                      placeholder="Escribe comentarios u observaciones del préstamo..."
                      value={dealNotes}
                      onChange={(e) => setDealNotes(e.target.value)}
                      rows={3}
                      className="block w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingDeal}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Enviar Solicitud
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-4 text-center text-xs text-slate-500">
                  No tienes permisos para solicitar préstamos para este contacto (Modo Solo Lectura).
                </div>
              )}

              {/* Listado Préstamos */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Solicitudes de Préstamos
                </h4>
                <div className="space-y-4">
                  {deals && deals.length > 0 ? (
                    deals.map((deal) => {
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
                        <div key={deal.id || deal.tempId} className="space-y-3 rounded-xl border border-slate-900 bg-slate-950 p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="block font-mono text-[10px] text-slate-500">
                                Creado: {new Date(deal.createdAt).toLocaleDateString()}
                              </span>
                              <h5 className="mt-0.5 text-sm font-bold text-white">
                                ${deal.amount.toLocaleString()} USD
                              </h5>
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                Plazo: {deal.termMonths} meses | Tasa: {deal.interestRate}%
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {deal.synced ? (
                                <span title="Sincronizado con el CRM">
                                  <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                                </span>
                              ) : (
                                <span title="Pendiente de Sincronización">
                                  <Database className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                                </span>
                              )}
                              {!isForeign && (
                                <button
                                  onClick={() => handleDeleteDeal(deal)}
                                  className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-900 hover:text-red-400"
                                  title="Eliminar préstamo"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {deal.notes && (
                            <p className="rounded border border-slate-900 bg-slate-900/50 p-2 font-mono text-xs leading-relaxed text-slate-400">
                              {deal.notes}
                            </p>
                          )}

                          {/* Stepper Horizontal */}
                          {deal.stage !== 'refused' && deal.stage !== 'overdue' && deal.stage !== 'completed' ? (
                            <div className="relative mt-4 flex items-center justify-between px-2 pb-1 pt-2">
                              <div className="absolute left-4 right-4 top-1/2 -z-10 h-0.5 -translate-y-[10px] bg-slate-800" />
                              <div
                                className="absolute left-4 top-1/2 -z-10 h-0.5 -translate-y-[10px] bg-emerald-500 transition-all duration-500"
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
                                return (
                                  <div key={step.stage} className="z-10 flex flex-col items-center">
                                    <div
                                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold transition-all ${
                                        status === 'completed'
                                          ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                          : status === 'active'
                                            ? 'border-indigo-500 bg-indigo-950 text-indigo-400 ring-2 ring-indigo-500/20'
                                            : 'border-slate-850 bg-slate-950 text-slate-500'
                                      }`}
                                    >
                                      {status === 'completed' ? '✓' : idx + 1}
                                    </div>
                                    <span
                                      className={`mt-1.5 text-[8px] font-semibold ${
                                        status === 'completed'
                                          ? 'text-emerald-400'
                                          : status === 'active'
                                            ? 'font-bold text-indigo-400'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {step.label}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}

                          {deal.stage === 'refused' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs font-semibold text-red-400">
                              <ShieldAlert className="h-4 w-4 shrink-0" />
                              <span>Solicitud Rechazada por Riesgos</span>
                            </div>
                          )}

                          {deal.stage === 'overdue' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs font-semibold text-red-400">
                              <ShieldAlert className="h-4 w-4 shrink-0" />
                              <span>Crédito en Mora (Vencido)</span>
                            </div>
                          )}

                          {deal.stage === 'completed' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs font-semibold text-emerald-400">
                              <CheckSquare className="h-4 w-4 shrink-0" />
                              <span>Crédito Completado (Pagado)</span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-500">
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
