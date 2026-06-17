'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  localDb,
  LocalLead,
  LocalInvoice,
  LocalActivity,
  LocalDeal,
} from '@/lib/db'
import LeadFormModal from '@/components/LeadFormModal'
import { searchGlobalLeads, getGlobalLeadDetails } from '@/app/actions/sync'
import { sendWhatsAppMessage, getWhatsAppTemplates } from '@/app/actions/whatsapp'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Cloud,
  Database,
  Filter,
  FileText,
  X,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Clock,
  MessageCircle,
  MessageSquare,
  Phone,
  Mail,
  CheckSquare,
  Bell,
  Wallet,
  Loader2,
  Send,
} from 'lucide-react'

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

// Las plantillas se cargan dinámicamente desde Infobip/Mock mediante la Server Action getWhatsAppTemplates

export default function ContactsPage() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Referencias para disparar los selectores de fecha/hora
  const dateInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  // Estado del Modal de Edición/Creación de Lead
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<LocalLead | null>(null)

  // Estado del Drawer de Historial Crediticio (Facturas) y Detalles
  const [selectedLeadForInvoice, setSelectedLeadForInvoice] =
    useState<LocalLead | null>(null)

  // Estado de Pestaña activa en el Drawer
  const [activeTab, setActiveTab] = useState<
    'finance' | 'activities' | 'deals'
  >('activities')

  // Estado del Formulario de Nuevo Préstamo (Deal)
  const [dealAmount, setDealAmount] = useState('')
  const [dealTermMonths, setDealTermMonths] = useState('12')
  const [dealInterestRate, setDealInterestRate] = useState('15')
  const [dealNotes, setDealNotes] = useState('')
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false)

  // Estado del Formulario de Actividad
  const [activityType, setActivityType] = useState<
    'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'WHATSAPP'
  >('NOTE')
  const [activityTitle, setActivityTitle] = useState('')
  const [activityBody, setActivityBody] = useState('')
  const [reminderDateOnly, setReminderDateOnly] = useState('')
  const [reminderTimeOnly, setReminderTimeOnly] = useState('08:00')
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [highlightedActivityId, setHighlightedActivityId] = useState<
    string | null
  >(null)
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false)

  // Estado para plantillas de WhatsApp
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([])
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [placeholderValues, setPlaceholderValues] = useState<string[]>([])

  // Reloj de control reactivo para actualizar los contadores y estados de ventana en tiempo real
  const [nowTime, setNowTime] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now())
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  // Cargar plantillas dinámicas desde Infobip / Mock al iniciar
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await getWhatsAppTemplates()
        if (res.success && res.templates) {
          setWhatsappTemplates(res.templates)
          // Pre-seleccionar la primera plantilla si existe
          if (res.templates.length > 0) {
            setSelectedTemplateName(res.templates[0].name)
          }
        }
      } catch (err) {
        console.error('Error al cargar plantillas de WhatsApp:', err)
      }
    }
    loadTemplates()
  }, [])

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState('')

  // 1. Obtener reactivamente todas las Empresas activas desde Dexie (para nombres y filtro)
  const companies = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.companies.filter((c) => c.deleted !== true).toArray()
    },
    [userId],
    [],
  )

  // 2. Obtener reactivamente todos los Leads activos desde Dexie
  const leads = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.leads
        .filter((l) => l.userId === userId && l.deleted !== true)
        .toArray()
    },
    [userId],
    [],
  )

  // 3. Obtener reactivamente las facturas asociadas al lead seleccionado para el Drawer
  const selectedLeadId =
    selectedLeadForInvoice?.id || selectedLeadForInvoice?.tempId || ''
  const invoices = useLiveQuery(
    async () => {
      if (!selectedLeadId) return []
      return await localDb.invoices
        .where('leadId')
        .equals(selectedLeadId)
        .toArray()
    },
    [selectedLeadId],
    [],
  )

  // 4. Obtener reactivamente las actividades asociadas al lead seleccionado para el Drawer
  const activities = useLiveQuery(
    async () => {
      if (!selectedLeadId) return []
      return await localDb.activities
        .where('leadId')
        .equals(selectedLeadId)
        .filter((a) => a.deleted !== true)
        .toArray()
    },
    [selectedLeadId],
    [],
  )

  // 5. Obtener reactivamente los préstamos (deals) asociados al lead seleccionado
  const deals = useLiveQuery(
    async () => {
      if (!selectedLeadId) return []
      return await localDb.deals
        .where('leadId')
        .equals(selectedLeadId)
        .filter((d) => d.deleted !== true)
        .toArray()
    },
    [selectedLeadId],
    [],
  )

  // 5b. Obtener reactivamente todos los préstamos (deals) activos del usuario para calcular el estado de cada lead en la lista
  const allDeals = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.deals
        .filter((d) => d.userId === userId && d.deleted !== true)
        .toArray()
    },
    [userId],
    [],
  )

  // 5c. Obtener reactivamente todas las actividades activas del usuario para calcular el estado de cada lead en la lista
  const allActivities = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.activities
        .filter((a) => a.userId === userId && a.deleted !== true)
        .toArray()
    },
    [userId],
    [],
  )

  // Estado para búsqueda global por DNI / Cédula
  const [globalLeads, setGlobalLeads] = useState<LocalLead[]>([])
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [foreignDetails, setForeignDetails] = useState<{
    invoices: LocalInvoice[]
    activities: LocalActivity[]
    deals: LocalDeal[]
  } | null>(null)
  const [isLoadingForeign, setIsLoadingForeign] = useState(false)

  const activeTemplate = whatsappTemplates.find(t => t.name === selectedTemplateName) || whatsappTemplates[0] || { name: '', label: '', language: 'es', text: '', placeholders: [] }

  useEffect(() => {
    if (selectedLeadForInvoice) {
      const vals = activeTemplate.placeholders.map((ph, idx) => {
        if (idx === 0) {
          return selectedLeadForInvoice.firstName || ''
        }
        return ''
      })
      setPlaceholderValues(vals)
    }
  }, [selectedTemplateName, selectedLeadForInvoice, activeTemplate.placeholders])

  const isForeign = selectedLeadForInvoice
    ? selectedLeadForInvoice.userId !== userId
    : false

  // Effect para buscar contacto globalmente por DNI en el servidor (online)
  useEffect(() => {
    const searchGlobal = async () => {
      if (!searchTerm.trim()) {
        setGlobalLeads([])
        return
      }

      // Solo buscar si estamos online y autenticados
      if (typeof window !== 'undefined' && !navigator.onLine) return
      if (!userId) return

      setIsSearchingGlobal(true)
      try {
        const results = await searchGlobalLeads(searchTerm.trim())
        const mappedLeads: LocalLead[] = results.map((result) => ({
          id: result.id,
          firstName: result.firstName,
          lastName: result.lastName,
          email: result.email,
          phone: result.phone || undefined,
          documentId: result.documentId || undefined,
          companyId: result.companyId || undefined,
          scoring: result.scoring || undefined,
          userId: result.userId,
          synced: true,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        }))
        setGlobalLeads(mappedLeads)
      } catch (err) {
        console.error('Error al buscar contacto globalmente:', err)
      } finally {
        setIsSearchingGlobal(false)
      }
    }

    const timer = setTimeout(searchGlobal, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, userId])

  // Effect para cargar detalles de leads ajenos (foreign) desde MongoDB
  useEffect(() => {
    const loadForeignDetails = async () => {
      if (!selectedLeadForInvoice || !selectedLeadForInvoice.id) {
        setForeignDetails(null)
        return
      }

      if (selectedLeadForInvoice.userId !== userId) {
        setIsLoadingForeign(true)
        try {
          const details = await getGlobalLeadDetails(selectedLeadForInvoice.id)
          setForeignDetails({
            invoices: details.invoices as any[],
            activities: details.activities.map((act) => ({
              ...act,
              type: act.type as any,
              synced: true,
            })),
            deals: details.deals.map((d) => ({
              ...d,
              stage: d.stage as any,
              synced: true,
            })),
          })
        } catch (err) {
          console.error('Error al obtener detalles globales del contacto:', err)
        } finally {
          setIsLoadingForeign(false)
        }
      } else {
        setForeignDetails(null)
      }
    }
    loadForeignDetails()
  }, [selectedLeadForInvoice, userId])

  // Soft Delete del Lead
  const handleDeleteLead = async (lead: LocalLead) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar a ${lead.firstName} ${lead.lastName}?`,
      )
    )
      return
    try {
      const now = Date.now()
      if (lead.id) {
        // Tiene ID real: marcar soft delete para sincronizar con el servidor
        await localDb.leads.where('id').equals(lead.id).modify({
          deleted: true,
          synced: false,
          updatedAt: now,
        })
      } else if (lead.tempId) {
        // Creado offline y nunca sincronizado: borrar directamente del cliente
        await localDb.leads.where('tempId').equals(lead.tempId).delete()
      }

      // Si el lead que se está eliminando es el seleccionado en el drawer, cerrarlo
      if (
        selectedLeadForInvoice?.id === lead.id ||
        selectedLeadForInvoice?.tempId === lead.tempId
      ) {
        setSelectedLeadForInvoice(null)
      }
    } catch (err) {
      console.error('[Contacts] Error al eliminar lead:', err)
    }
  }

  // Registrar una nueva actividad offline en Dexie
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !selectedLeadId || selectedLeadForInvoice?.userId !== userId)
      return

    const titleVal = (activityType as string) === 'WHATSAPP' ? 'Mensaje de WhatsApp' : activityTitle.trim()
    let bodyVal = activityBody.trim()

    if ((activityType as string) === 'WHATSAPP') {
      const activeTemplate = whatsappTemplates.find(t => t.name === selectedTemplateName) || whatsappTemplates[0] || { name: '', label: '', language: 'es', text: '', placeholders: [] }
      if (!wsActive) {
        // En modo plantilla, el body es el texto con los placeholders reemplazados
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

      if ((activityType as string) === 'WHATSAPP') {
        let result
        if (wsActive) {
          result = await sendWhatsAppMessage(selectedLeadId, bodyVal)
        } else {
          const activeTemplate = whatsappTemplates.find(t => t.name === selectedTemplateName) || whatsappTemplates[0] || { name: '', label: '', language: 'es', text: '', placeholders: [] }
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
            synced: false, // El motor saliente consolidará crmSynced: true
            createdAt: now,
            updatedAt: now,
          }
          await localDb.activities.put(localAct)
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
      // 1. Registrar la actividad principal (Nota, Llamada, Reunión, Email)
      const newMainAct: LocalActivity = {
        tempId: crypto.randomUUID(),
        leadId: selectedLeadId,
        userId,
        type: activityType,
        title: titleVal,
        body: bodyVal,
        timestamp: now,
        synced: false,
        createdAt: now,
        updatedAt: now,
      }
      await localDb.activities.put(newMainAct)

      // 2. Si se definió un recordatorio, registrar una actividad separada de tipo TASK (Tarea)
      if (reminderTimestamp) {
        const newTaskAct: LocalActivity = {
          tempId: crypto.randomUUID(),
          leadId: selectedLeadId,
          userId,
          type: 'TASK',
          title: `Recordatorio: ${titleVal}`,
          body: bodyVal,
          timestamp: now,
          reminderDate: reminderTimestamp,
          synced: false,
          createdAt: now,
          updatedAt: now,
        }
        await localDb.activities.put(newTaskAct)
      }

      // Limpiar formulario
      setActivityTitle('')
      setActivityBody('')
      setActivityType('NOTE')
      setReminderDateOnly('')
      setReminderTimeOnly('08:00')
      setShowReminderPicker(false)
    } catch (err) {
      console.error('[Contacts] Error al agregar actividad:', err)
    } finally {
      setIsSubmittingActivity(false)
    }
  }

  // Soft delete de actividad en Dexie
  const handleDeleteActivity = async (act: LocalActivity) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta actividad?')) return
    try {
      const now = Date.now()
      if (act.id) {
        // Marcamos soft-delete local para sincronizar al servidor
        await localDb.activities.where('id').equals(act.id).modify({
          deleted: true,
          synced: false,
          updatedAt: now,
        })
      } else if (act.tempId) {
        // Creado localmente y no sincronizado: borrar físicamente
        await localDb.activities.where('tempId').equals(act.tempId).delete()
      }
    } catch (err) {
      console.error('[Contacts] Error al eliminar actividad:', err)
    }
  }

  // Marcar recordatorio como leído desde el historial
  const handleMarkReminderAsRead = async (act: LocalActivity) => {
    if (selectedLeadForInvoice?.userId !== userId) return
    try {
      const now = Date.now()
      const actKey = act.tempId || act.id
      if (actKey) {
        const notif = await localDb.notifications
          .where('activityId')
          .equals(actKey)
          .first()
        if (notif) {
          await localDb.notifications.update(notif.id, {
            read: true,
            notified: true,
          })
        }
      }

      if (act.tempId) {
        await localDb.activities.update(act.tempId, {
          reminderRead: true,
          synced: false,
          updatedAt: now,
        })
      }
    } catch (err) {
      console.error('[Contacts] Error al marcar recordatorio como leído:', err)
    }
  }

  // Eliminar recordatorio de una actividad manteniendo la nota
  const handleRemoveReminder = async (act: LocalActivity) => {
    if (selectedLeadForInvoice?.userId !== userId) return
    if (
      !confirm(
        '¿Estás seguro de que deseas eliminar este recordatorio? La nota permanecerá en el historial.',
      )
    )
      return
    try {
      const now = Date.now()
      const actKey = act.tempId || act.id
      if (actKey) {
        const notif = await localDb.notifications
          .where('activityId')
          .equals(actKey)
          .first()
        if (notif) {
          await localDb.notifications.delete(notif.id)
        }
      }

      if (act.tempId) {
        if (act.type === 'TASK') {
          // Si es una Tarea independiente (alarma), la eliminamos por completo
          await localDb.activities.update(act.tempId, {
            deleted: true,
            synced: false,
            updatedAt: now,
          })
        } else {
          // Retrocompatibilidad: Si es una nota antigua con recordatorio embebido, limpiamos el campo
          await localDb.activities.update(act.tempId, {
            reminderDate: null as any,
            reminderRead: false,
            synced: false,
            updatedAt: now,
          })
        }
      }
    } catch (err) {
      console.error('[Contacts] Error al eliminar recordatorio:', err)
    }
  }

  // Registrar una nueva solicitud de préstamo offline en Dexie
  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !userId ||
      !selectedLeadId ||
      !selectedLeadForInvoice ||
      selectedLeadForInvoice.userId !== userId
    )
      return
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
        stage: 'draft', // El vendedor origina en borrador
        notes: dealNotes.trim() || undefined,
        synced: false,
        createdAt: now,
        updatedAt: now,
      }

      await localDb.deals.put(newDeal)

      // Limpiar formulario
      setDealAmount('')
      setDealTermMonths('12')
      setDealInterestRate('15')
      setDealNotes('')
    } catch (err) {
      console.error('[Contacts] Error al registrar préstamo:', err)
    } finally {
      setIsSubmittingDeal(false)
    }
  }

  // Soft Delete de Deal en Dexie
  const handleDeleteDeal = async (deal: LocalDeal) => {
    if (
      !confirm(
        '¿Estás seguro de que deseas eliminar esta solicitud de préstamo?',
      )
    )
      return
    try {
      const now = Date.now()
      if (deal.id) {
        // Tiene ID real: marcar soft delete para sincronizar al servidor
        await localDb.deals.where('id').equals(deal.id).modify({
          deleted: true,
          synced: false,
          updatedAt: now,
        })
      } else if (deal.tempId) {
        // Creado localmente y no sincronizado: borrar físicamente
        await localDb.deals.where('tempId').equals(deal.tempId).delete()
      }
    } catch (err) {
      console.error('[Contacts] Error al eliminar préstamo:', err)
    }
  }

  // Escuchar eventos de recordatorios del Header para abrir Drawer reactivamente
  useEffect(() => {
    const handleOpenReminder = (e: Event) => {
      const customEvent = e as CustomEvent<{
        leadId: string
        activityId: string
      }>
      const { leadId, activityId } = customEvent.detail
      if (activityId) {
        setHighlightedActivityId(activityId)
      }
      if (leadId && leads.length > 0) {
        const foundLead = leads.find(
          (l) => l.id === leadId || l.tempId === leadId,
        )
        if (foundLead) {
          setSelectedLeadForInvoice(foundLead)
          setActiveTab('activities')
        }
      }
    }
    window.addEventListener('open-lead-reminder', handleOpenReminder)
    return () => {
      window.removeEventListener('open-lead-reminder', handleOpenReminder)
    }
  }, [leads])

  // Auto-seleccionar Lead si viene de un recordatorio en la URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const leadIdParam = params.get('leadId')
    const activityIdParam = params.get('activityId')

    if (activityIdParam) {
      setHighlightedActivityId(activityIdParam)
    }

    if (leadIdParam && leads.length > 0) {
      const foundLead = leads.find(
        (l) => l.id === leadIdParam || l.tempId === leadIdParam,
      )
      if (foundLead) {
        setSelectedLeadForInvoice(foundLead)
        setActiveTab('activities')
        const newParams = new URLSearchParams(window.location.search)
        newParams.delete('leadId')
        newParams.delete('activityId')
        const newSearch = newParams.toString()
        const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [leads])

  // Efecto para hacer scroll automático a la actividad resaltada
  useEffect(() => {
    if (highlightedActivityId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(
          `activity-${highlightedActivityId}`,
        )
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })

          // Desvanecer el resaltado a los 3 segundos
          setTimeout(() => {
            setHighlightedActivityId(null)
          }, 3000)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [highlightedActivityId])

  // Configuración de estilo y visualización según el tipo de actividad
  const getActivityConfig = (type: LocalActivity['type']) => {
    switch (type) {
      case 'CALL':
        return {
          icon: Phone,
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          text: 'text-blue-400',
        }
      case 'MEETING':
        return {
          icon: Calendar,
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/20',
          text: 'text-purple-400',
        }
      case 'EMAIL':
        return {
          icon: Mail,
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          text: 'text-amber-400',
        }
      case 'TASK':
        return {
          icon: CheckSquare,
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/20',
          text: 'text-rose-400',
        }
      case 'WHATSAPP':
        return {
          icon: MessageCircle,
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
          text: 'text-emerald-400',
        }
      case 'NOTE':
      default:
        return {
          icon: MessageSquare,
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
          text: 'text-emerald-400',
        }
    }
  }

  // Combinar leads locales con leads globales encontrados (evitando duplicados)
  const allLeadsCombined = [...(leads || [])]
  globalLeads.forEach((gl) => {
    const alreadyExists = allLeadsCombined.some(
      (l) => l.id === gl.id || (l.documentId && l.documentId === gl.documentId),
    )
    if (!alreadyExists) {
      allLeadsCombined.push(gl)
    }
  })

  // Filtrado de Leads
  const filteredLeads = allLeadsCombined.filter((lead) => {
    const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase()
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.documentId &&
        lead.documentId.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCompany = filterCompanyId
      ? lead.companyId === filterCompanyId
      : true

    return matchesSearch && matchesCompany
  })

  // Obtener nombre de empresa por ID
  const getCompanyName = (compId?: string) => {
    if (!compId) return 'Ninguna'
    const comp = companies.find((c) => c.id === compId || c.tempId === compId)
    return comp ? comp.name : 'Cargando...'
  }

  // Badges de color premium para el Scoring
  const getScoringBadge = (scoring?: string) => {
    if (!scoring)
      return <span className="text-xs font-semibold text-slate-500">-</span>

    if (scoring.startsWith('A')) {
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
          {scoring}
        </span>
      )
    }
    if (scoring.startsWith('B')) {
      return (
        <span className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-400">
          {scoring}
        </span>
      )
    }
    if (scoring.startsWith('C')) {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400">
          {scoring}
        </span>
      )
    }
    return (
      <span className="inline-flex animate-pulse items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400">
        {scoring}
      </span>
    )
  }

  // Resolver el estado del lead de manera reactiva/dinámica en función de sus préstamos (deals) y actividades
  const getLeadStatus = (lead: LocalLead) => {
    const leadKey = lead.id || lead.tempId || ''

    // Si es un lead ajeno (no pertenece al usuario actual)
    if (lead.userId !== userId) {
      // Si es el lead seleccionado en el drawer y ya cargamos sus detalles
      if (selectedLeadForInvoice?.id === lead.id && foreignDetails) {
        const dealsList = foreignDetails.deals || []
        const actsList = foreignDetails.activities || []

        const hasApproved = dealsList.some(
          (d) =>
            d.stage === 'approved' ||
            d.stage === 'disbursed' ||
            d.stage === 'completed',
        )
        if (hasApproved) return 'Aprobado'

        const hasInProcess =
          dealsList.some(
            (d) => d.stage === 'under_evaluation' || d.stage === 'draft',
          ) || actsList.length > 0
        if (hasInProcess) return 'En Proceso'

        const hasRejected = dealsList.some((d) => d.stage === 'refused')
        if (hasRejected) return 'Rechazado'

        return 'Nuevo'
      }
      return 'Ajeno'
    }

    // Para leads locales
    if (!allDeals || !allActivities) return 'Cargando...'

    const leadDeals = allDeals.filter((d) => d.leadId === leadKey)
    const leadActivities = allActivities.filter((a) => a.leadId === leadKey)

    const hasApproved = leadDeals.some(
      (d) =>
        d.stage === 'approved' ||
        d.stage === 'disbursed' ||
        d.stage === 'completed',
    )
    if (hasApproved) return 'Aprobado'

    const hasInProcess =
      leadDeals.some(
        (d) => d.stage === 'under_evaluation' || d.stage === 'draft',
      ) || leadActivities.length > 0
    if (hasInProcess) return 'En Proceso'

    const hasRejected = leadDeals.some((d) => d.stage === 'refused')
    if (hasRejected) return 'Rechazado'

    return 'Nuevo'
  }

  // Badge del estado con colores de la paleta del dashboard
  const getLeadStatusBadge = (lead: LocalLead) => {
    const status = getLeadStatus(lead)
    switch (status) {
      case 'Aprobado':
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            Aprobado
          </span>
        )
      case 'En Proceso':
        return (
          <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            En Proceso
          </span>
        )
      case 'Rechazado':
        return (
          <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            Rechazado
          </span>
        )
      case 'Nuevo':
        return (
          <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
            Nuevo
          </span>
        )
      case 'Cargando...':
        return (
          <span className="border-slate-850 inline-flex animate-pulse items-center rounded-full border bg-slate-950 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            Cargando...
          </span>
        )
      default: // 'Ajeno'
        return (
          <span
            className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400"
            title="Contacto de otro asesor, pulse para cargar estado"
          >
            Ajeno
          </span>
        )
    }
  }

  // Resolver los datos a mostrar en el Drawer (locales o remotos si es ajeno)
  const invoicesToShow = isForeign
    ? foreignDetails?.invoices || []
    : invoices || []
  const activitiesToShow = isForeign
    ? foreignDetails?.activities || []
    : activities || []
  const dealsToShow = isForeign ? foreignDetails?.deals || [] : deals || []

  // Calcular si la ventana de WhatsApp está activa (24 horas desde el último mensaje recibido)
  const wsIncoming = [...(activitiesToShow || [])]
    .filter(act => act.type === 'WHATSAPP' && act.title === 'WhatsApp Recibido')
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

  // Calcular el estado de la ventana de WhatsApp para cualquier lead en el listado de forma reactiva
  const getWhatsAppWindowStatus = (lead: LocalLead) => {
    // Si es un lead ajeno seleccionado en el Drawer, buscar sus actividades en foreignDetails
    const isLeadForeign = lead.userId !== userId
    const sourceActivities = (isLeadForeign && selectedLeadForInvoice?.id === lead.id)
      ? (foreignDetails?.activities || [])
      : (allActivities || [])

    const leadActivities = sourceActivities.filter(
      (a) =>
        (a.leadId === lead.id || (lead.tempId && a.leadId === lead.tempId)) &&
        a.type === 'WHATSAPP' &&
        a.title === 'WhatsApp Recibido'
    )

    if (leadActivities.length === 0) return null

    const sorted = [...leadActivities].sort((a, b) => b.timestamp - a.timestamp)
    const latestIncoming = sorted[0]
    const timeElapsed = nowTime - latestIncoming.timestamp
    const twentyFourHours = 24 * 60 * 60 * 1000

    if (timeElapsed < twentyFourHours) {
      const timeLeft = twentyFourHours - timeElapsed
      const hoursLeft = Math.floor(timeLeft / (3600 * 1000))
      const minutesLeft = Math.floor((timeLeft % (3600 * 1000)) / 60000)
      return {
        active: true,
        text: `Restan ${hoursLeft}h ${minutesLeft}m`,
      }
    }

    return {
      active: false,
      text: 'Expirada',
    }
  }

  // Calcular métricas rápidas del Historial de Facturas
  const totalInvoicesAmount =
    invoicesToShow?.reduce((sum, inv) => sum + inv.amount, 0) || 0
  const totalBalanceDue =
    invoicesToShow?.reduce(
      (sum, inv) =>
        sum + (inv.balanceDue ?? (inv.status === 'PAID' ? 0 : inv.amount)),
      0,
    ) || 0
  const paidInvoices =
    invoicesToShow?.filter((inv) => inv.status === 'PAID') || []
  const pendingInvoices =
    invoicesToShow?.filter((inv) => inv.status === 'PENDING') || []
  const overdueInvoices =
    invoicesToShow?.filter((inv) => inv.status === 'OVERDUE') || []

  const paymentRatio =
    invoicesToShow && invoicesToShow.length > 0
      ? Math.round((paidInvoices.length / invoicesToShow.length) * 100)
      : 100

  // Carga inicial mientras NextAuth resuelve la sesión
  if (status === 'loading' || !userId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-slate-400">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="animate-pulse text-sm font-medium">
          Cargando contactos...
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen gap-6">
      {/* Contenedor Principal de la Lista de Contactos */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Sección de Encabezado */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              <Users className="h-8 w-8 text-indigo-400" />
              Contactos
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Visualiza y administra tus leads almacenados localmente y
              sincronizados con el CRM.
            </p>
          </div>

          <button
            onClick={() => {
              setLeadToEdit(null)
              setIsLeadModalOpen(true)
            }}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:from-indigo-600 hover:to-violet-700"
          >
            <Plus className="h-4.5 w-4.5" />
            Nuevo Contacto
          </button>
        </div>

        {/* Buscador y Filtros */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* Buscador */}
            <div className="relative w-full sm:flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                {isSearchingGlobal ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-500" />
                ) : (
                  <Search className="h-4.5 w-4.5" />
                )}
              </div>
              <input
                type="text"
                placeholder="Buscar por DNI/Cédula (Búsqueda global) o nombre/email local..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Filtro de Empresas */}
            <div className="relative w-full sm:w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Filter className="h-4.5 w-4.5" />
              </div>
              <select
                value={filterCompanyId}
                onChange={(e) => setFilterCompanyId(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Todas las empresas</option>
                {companies.map((c) => (
                  <option key={c.id || c.tempId} value={c.id || c.tempId}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-slate-500">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Leads */}
        <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md md:block">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-4">
                    Nombre
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Teléfono
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Empresa
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Scoring
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-4">
                    Origen / Sinc
                  </th>
                  <th scope="col" className="px-6 py-4 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-transparent">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id || lead.tempId}
                      className={`cursor-pointer transition-colors hover:bg-slate-900/40 ${
                        selectedLeadForInvoice?.id === lead.id ||
                        selectedLeadForInvoice?.tempId === lead.tempId
                          ? 'border-l-2 border-indigo-500 bg-slate-900/60'
                          : ''
                      }`}
                      onClick={() => setSelectedLeadForInvoice(lead)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">
                          {lead.firstName} {lead.lastName}
                        </div>
                        {lead.documentId && (
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                            ID: {lead.documentId}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{lead.email}</td>
                      <td className="px-6 py-4 text-slate-400">
                        <div>{lead.phone || '-'}</div>
                        {(() => {
                          const status = getWhatsAppWindowStatus(lead)
                          if (!status) return null
                          return (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                status.active 
                                  ? 'bg-emerald-500 animate-pulse' 
                                  : 'bg-slate-600'
                              }`} />
                              <span className={`text-[10px] font-semibold tracking-wide ${
                                status.active 
                                  ? 'text-emerald-400' 
                                  : 'text-slate-500'
                              }`}>
                                WA: {status.text}
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                          {getCompanyName(lead.companyId)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getScoringBadge(lead.scoring)}
                      </td>
                      <td className="px-6 py-4">{getLeadStatusBadge(lead)}</td>
                      <td
                        className="px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.synced ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                            <Cloud className="h-3.5 w-3.5" />
                            CloudDb
                          </span>
                        ) : (
                          <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                            <Database className="h-3.5 w-3.5" />
                            LocalDb
                          </span>
                        )}
                      </td>
                      <td
                        className="px-6 py-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedLeadForInvoice(lead)}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-indigo-400"
                            title="Ver Historial Crediticio"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setLeadToEdit(lead)
                              setIsLeadModalOpen(true)
                            }}
                            disabled={lead.userId !== userId}
                            className={`rounded-lg p-1.5 transition-colors ${
                              lead.userId !== userId
                                ? 'text-slate-750 cursor-not-allowed opacity-40'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                            title={
                              lead.userId !== userId
                                ? 'Solo Lectura (Propietario ajeno)'
                                : 'Editar'
                            }
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead)}
                            disabled={lead.userId !== userId}
                            className={`rounded-lg p-1.5 transition-colors ${
                              lead.userId !== userId
                                ? 'text-slate-750 cursor-not-allowed opacity-40'
                                : 'text-slate-400 hover:bg-red-500/20 hover:text-red-400'
                            }`}
                            title={
                              lead.userId !== userId
                                ? 'Solo Lectura (Propietario ajeno)'
                                : 'Eliminar'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No se encontraron leads registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vista móvil (Tarjetas) */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => (
              <div
                key={lead.id || lead.tempId}
                onClick={() => setSelectedLeadForInvoice(lead)}
                className={`cursor-pointer space-y-3 rounded-2xl border p-4 transition-all duration-300 ${
                  selectedLeadForInvoice?.id === lead.id ||
                  selectedLeadForInvoice?.tempId === lead.tempId
                    ? 'border-indigo-500 bg-slate-900/40 shadow-md ring-1 ring-indigo-500/20'
                    : 'border-slate-800 bg-slate-900/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {lead.email}
                    </p>
                    {lead.documentId && (
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        ID: {lead.documentId}
                      </p>
                    )}
                    {lead.phone && (
                      <div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {lead.phone}
                        </p>
                        {(() => {
                          const status = getWhatsAppWindowStatus(lead)
                          if (!status) return null
                          return (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                status.active 
                                  ? 'bg-emerald-500 animate-pulse' 
                                  : 'bg-slate-600'
                              }`} />
                              <span className={`text-[10px] font-semibold tracking-wide ${
                                status.active 
                                  ? 'text-emerald-400' 
                                  : 'text-slate-500'
                              }`}>
                                WA: {status.text}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.synced ? (
                      <span
                        className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 p-1 text-emerald-400"
                        title="CloudDb"
                      >
                        <Cloud className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span
                        className="inline-flex animate-pulse items-center rounded-full border border-amber-500/20 bg-amber-500/10 p-1 text-amber-400"
                        title="LocalDb"
                      >
                        <Database className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {getScoringBadge(lead.scoring)}
                  </div>
                </div>

                <div className="border-slate-850 flex items-center justify-between border-t pt-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded border border-slate-800/80 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-400">
                      {getCompanyName(lead.companyId)}
                    </span>
                    {getLeadStatusBadge(lead)}
                  </div>

                  <div
                    className="flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setSelectedLeadForInvoice(lead)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-indigo-400"
                      title="Ver Historial Crediticio"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setLeadToEdit(lead)
                        setIsLeadModalOpen(true)
                      }}
                      disabled={lead.userId !== userId}
                      className={`rounded-lg p-1.5 transition-colors ${
                        lead.userId !== userId
                          ? 'text-slate-750 cursor-not-allowed opacity-40'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                      title={
                        lead.userId !== userId
                          ? 'Solo Lectura (Propietario ajeno)'
                          : 'Editar'
                      }
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLead(lead)}
                      disabled={lead.userId !== userId}
                      className={`rounded-lg p-1.5 transition-colors ${
                        lead.userId !== userId
                          ? 'text-slate-750 cursor-not-allowed opacity-40'
                          : 'text-slate-400 hover:bg-red-500/20 hover:text-red-400'
                      }`}
                      title={
                        lead.userId !== userId
                          ? 'Solo Lectura (Propietario ajeno)'
                          : 'Eliminar'
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="py-12 text-center text-xs text-slate-500">
              No se encontraron contactos.
            </p>
          )}
        </div>
      </div>

      {/* Slide-over Drawer: Detalles del Contacto (Finanzas y Actividades) */}
      {selectedLeadForInvoice && (
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
                  {selectedLeadForInvoice.firstName}{' '}
                  {selectedLeadForInvoice.lastName}
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
                <span>
                  Contacto de otro asesor. Modo Solo Lectura habilitado.
                </span>
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
                          $
                          {totalBalanceDue.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
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

                  {/* Alertas de Vencimiento si existen facturas pendientes o vencidas */}
                  {overdueInvoices.length > 0 && (
                    <div className="flex gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-300">
                      <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
                      <div>
                        <span className="block font-bold">
                          ¡Facturas Vencidas!
                        </span>
                        <span>
                          Este lead posee {overdueInvoices.length} factura(s)
                          vencida(s) en HubSpot. Riesgo crediticio activo.
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
                      {invoicesToShow && invoicesToShow.length > 0 ? (
                        invoicesToShow.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-start justify-between rounded-xl border border-slate-900 bg-slate-950 p-4"
                          >
                            <div className="space-y-1.5">
                              <span className="block font-mono text-[10px] text-slate-500">
                                INV-ID: {inv.crmId?.slice(-6) || 'LOCAL'}
                              </span>
                              <span className="block text-sm font-bold text-white">
                                $
                                {inv.amount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                USD
                              </span>
                              {inv.status !== 'PAID' &&
                                inv.balanceDue !== undefined &&
                                inv.balanceDue !== inv.amount && (
                                  <span className="text-slate-450 block text-[10px] font-semibold">
                                    Pendiente: $
                                    {inv.balanceDue.toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                    })}{' '}
                                    USD
                                  </span>
                                )}
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  Vencimiento:{' '}
                                  {new Date(inv.dueDate).toLocaleDateString()}
                                </span>
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
                                  Pago:{' '}
                                  {new Date(
                                    inv.paymentDate,
                                  ).toLocaleDateString()}
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
                  {/* Formulario para registrar actividad */}
                  {!isForeign ? (
                    <form
                      onSubmit={handleAddActivity}
                      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/20 p-4 backdrop-blur-md"
                    >
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Registrar Actividad
                      </h4>

                      <div className={activityType === 'WHATSAPP' ? "block" : "grid grid-cols-2 gap-3"}>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Tipo
                          </label>
                          <select
                            value={activityType}
                            onChange={(e) =>
                              setActivityType(e.target.value as any)
                            }
                            className="placeholder-slate-505 block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white transition-colors focus:border-indigo-500 focus:outline-none"
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
                              className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Campos dinámicos si es WhatsApp */}
                      {activityType === 'WHATSAPP' ? (
                        <div className="space-y-4">
                          {/* Banner de estado de la ventana de sesión de WhatsApp */}
                          <div className={`rounded-lg p-2.5 text-center text-xs font-semibold border ${
                            wsActive 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            {wsText}
                          </div>

                          {!wsActive ? (
                            // Modo plantilla si la ventana está cerrada
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

                              {/* Inputs dinámicos para las variables de plantilla */}
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

                              {/* Vista previa del mensaje */}
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
                            // Modo Texto Libre si la ventana de 24 hs está activa
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
                                className="block w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        // Formulario regular para Nota/Llamada/Reunión/Correo/Tarea
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
                              className="block w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
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
                                        if (
                                          typeof dateInputRef.current
                                            ?.showPicker === 'function'
                                        ) {
                                          try {
                                            dateInputRef.current.showPicker()
                                          } catch (_) {}
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
                                      onChange={(e) =>
                                        setReminderDateOnly(e.target.value)
                                      }
                                      onClick={(e) => {
                                        if (
                                          typeof e.currentTarget.showPicker ===
                                          'function'
                                        ) {
                                          try {
                                            e.currentTarget.showPicker()
                                          } catch (_) {}
                                        }
                                      }}
                                      required={showReminderPicker}
                                      className="block w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
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
                                        if (
                                          typeof timeInputRef.current
                                            ?.showPicker === 'function'
                                        ) {
                                          try {
                                            timeInputRef.current.showPicker()
                                          } catch (_) {}
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
                                      onChange={(e) =>
                                        setReminderTimeOnly(e.target.value)
                                      }
                                      onClick={(e) => {
                                        if (
                                          typeof e.currentTarget.showPicker ===
                                          'function'
                                        ) {
                                          try {
                                            e.currentTarget.showPicker()
                                          } catch (_) {}
                                        }
                                      }}
                                      required={showReminderPicker}
                                      className="block w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
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
                      No tienes permisos para registrar actividades en este
                      contacto (Modo Solo Lectura).
                    </div>
                  )}

                  {/* Línea de tiempo de Actividades */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Historial de Actividades
                    </h4>

                    <div className="relative ml-3.5 space-y-6 border-l border-slate-800 pl-6">
                      {activitiesToShow && activitiesToShow.length > 0 ? (
                        [...activitiesToShow]
                          .sort((a, b) => b.timestamp - a.timestamp)
                          .map((act) => {
                            const config = getActivityConfig(act.type)
                            const IconComponent = config.icon

                            return (
                              <div
                                key={act.id || act.tempId}
                                className="group relative"
                              >
                                {/* Punto/Icono en el timeline */}
                                <div
                                  className={`absolute -left-[38px] top-1 rounded-full border p-1.5 ${config.bg} ${config.border} ${config.text} shadow-md`}
                                >
                                  <IconComponent className="h-3.5 w-3.5" />
                                </div>

                                {/* Card de Actividad */}
                                <div
                                  id={`activity-${act.id || act.tempId}`}
                                  className={`space-y-2 rounded-xl border p-4 transition-all duration-500 ${
                                    highlightedActivityId === act.id ||
                                    highlightedActivityId === act.tempId
                                      ? 'scale-[1.02] border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20'
                                      : 'border-slate-900 bg-slate-950/80'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <span className="block font-mono text-[9px] text-slate-500">
                                        {new Date(
                                          act.timestamp,
                                        ).toLocaleString()}
                                      </span>
                                      <h5 className="mt-0.5 text-xs font-bold text-white">
                                        {act.title}
                                      </h5>
                                    </div>

                                    <div
                                      className="flex items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {act.synced ? (
                                        <span title="Sincronizado con HubSpot">
                                          <Cloud className="h-3.5 w-3.5 text-slate-600" />
                                        </span>
                                      ) : (
                                        <span title="Guardado localmente, pendiente de sincronización">
                                          <Database className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                                        </span>
                                      )}
                                      <button
                                        onClick={() =>
                                          handleDeleteActivity(act)
                                        }
                                        className="hover:text-red-450 rounded p-1 text-slate-600 transition-colors hover:bg-slate-900"
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
                                          Recordatorio:{' '}
                                          {new Date(
                                            act.reminderDate,
                                          ).toLocaleString()}
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
                                              onClick={() =>
                                                handleMarkReminderAsRead(act)
                                              }
                                              className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/20 px-2 py-1 text-[9px] font-bold text-indigo-300 transition-colors hover:bg-indigo-500/30 hover:text-indigo-200"
                                            >
                                              <CheckSquare className="h-3 w-3" />
                                              Marcar Leído
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveReminder(act)
                                            }
                                            className="flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
                                          >
                                            <X className="h-3 w-3" />
                                            Quitar Alarma
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                      ) : (
                        <p className="-ml-3.5 py-6 text-center text-xs text-slate-500">
                          No se encontraron actividades registradas para este
                          contacto.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Formulario de creación */}
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
                            className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Plazo (Meses)
                          </label>
                          <select
                            value={dealTermMonths}
                            onChange={(e) => setDealTermMonths(e.target.value)}
                            className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white transition-colors focus:border-indigo-500 focus:outline-none"
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
                          className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
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
                          className="block w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingDeal}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Enviar Solicitud
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-4 text-center text-xs text-slate-500">
                      No tienes permisos para solicitar préstamos para este
                      contacto (Modo Solo Lectura).
                    </div>
                  )}

                  {/* Listado de Préstamos Activos */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Solicitudes de Préstamos
                    </h4>
                    <div className="space-y-4">
                      {dealsToShow && dealsToShow.length > 0 ? (
                        dealsToShow.map((deal) => {
                          const steps = [
                            { stage: 'draft', label: 'Borrador' },
                            { stage: 'under_evaluation', label: 'Riesgo' },
                            { stage: 'approved', label: 'Aprobado' },
                            { stage: 'disbursed', label: 'Desembolsado' },
                          ]

                          const getStepStatus = (
                            dealStage: string,
                            stepStage: string,
                          ) => {
                            const stageOrder = [
                              'draft',
                              'under_evaluation',
                              'approved',
                              'disbursed',
                              'completed',
                            ]
                            const currentIdx = stageOrder.indexOf(dealStage)
                            const stepIdx = stageOrder.indexOf(stepStage)

                            if (
                              dealStage === 'refused' ||
                              dealStage === 'overdue'
                            ) {
                              return 'disabled'
                            }
                            if (currentIdx >= 3 && dealStage === 'completed') {
                              return 'completed'
                            }
                            if (stepIdx < currentIdx) return 'completed'
                            if (stepIdx === currentIdx) return 'active'
                            return 'upcoming'
                          }

                          return (
                            <div
                              key={deal.id || deal.tempId}
                              className="space-y-3 rounded-xl border border-slate-900 bg-slate-950 p-4"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="block font-mono text-[10px] text-slate-500">
                                    Creado:{' '}
                                    {new Date(
                                      deal.createdAt,
                                    ).toLocaleDateString()}
                                  </span>
                                  <h5 className="mt-0.5 text-sm font-bold text-white">
                                    ${deal.amount.toLocaleString()} USD
                                  </h5>
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    Plazo: {deal.termMonths} meses | Tasa:{' '}
                                    {deal.interestRate}%
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {deal.synced ? (
                                    <span title="Sincronizado con el CRM">
                                      <Cloud className="h-3.5 w-3.5 text-slate-600" />
                                    </span>
                                  ) : (
                                    <span title="Pendiente de sincronización">
                                      <Database className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                                    </span>
                                  )}
                                  {!isForeign && (
                                    <button
                                      onClick={() => handleDeleteDeal(deal)}
                                      className="hover:text-red-450 rounded p-1 text-slate-600 transition-colors hover:bg-slate-900"
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
                              {deal.stage !== 'refused' &&
                              deal.stage !== 'overdue' &&
                              deal.stage !== 'completed' ? (
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
                                    const status = getStepStatus(
                                      deal.stage,
                                      step.stage,
                                    )
                                    return (
                                      <div
                                        key={step.stage}
                                        className="z-10 flex flex-col items-center"
                                      >
                                        <div
                                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold transition-all ${
                                            status === 'completed'
                                              ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                              : status === 'active'
                                                ? 'border-indigo-500 bg-indigo-950 text-indigo-400 ring-2 ring-indigo-500/20'
                                                : 'border-slate-850 bg-slate-950 text-slate-500'
                                          }`}
                                        >
                                          {status === 'completed'
                                            ? '✓'
                                            : idx + 1}
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
                                <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs font-semibold text-rose-400">
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
                          No hay solicitudes de préstamos registradas para este
                          contacto.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Formulario Modal para Leads */}
      <LeadFormModal
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false)
          setLeadToEdit(null)
        }}
        userId={userId}
        leadToEdit={leadToEdit}
      />
    </div>
  )
}
