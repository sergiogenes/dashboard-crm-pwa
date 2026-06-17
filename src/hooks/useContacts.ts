'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  localDb,
  LocalLead,
  LocalInvoice,
  LocalActivity,
  LocalDeal,
} from '@/lib/db'
import { searchGlobalLeads, getGlobalLeadDetails } from '@/app/actions/sync'
import { getWhatsAppTemplates } from '@/app/actions/whatsapp'

export interface WhatsAppTemplate {
  name: string
  label: string
  language: string
  text: string
  placeholders: string[]
}

export function useContacts() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Estado del Modal de Edición/Creación de Lead
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<LocalLead | null>(null)

  // Estado del Drawer de Historial Crediticio (Facturas) y Detalles
  const [selectedLeadForInvoice, setSelectedLeadForInvoice] =
    useState<LocalLead | null>(null)

  const [highlightedActivityId, setHighlightedActivityId] = useState<
    string | null
  >(null)

  // Estado para plantillas de WhatsApp
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([])

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

  // 1. Obtener reactivamente todas las Empresas activas desde Dexie
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

  // 5b. Obtener reactivamente todos los préstamos (deals) activos del usuario
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

  // 5c. Obtener reactivamente todas las actividades activas del usuario
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
        await localDb.leads.where('id').equals(lead.id).modify({
          deleted: true,
          synced: false,
          updatedAt: now,
        })
      } else if (lead.tempId) {
        await localDb.leads.where('tempId').equals(lead.tempId).delete()
      }

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

          setTimeout(() => {
            setHighlightedActivityId(null)
          }, 3000)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [highlightedActivityId])

  // Combinar leads locales con leads globales
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

  // Resolver el estado del lead de manera reactiva/dinámica en función de sus préstamos (deals) y actividades
  const getLeadStatus = (lead: LocalLead) => {
    const leadKey = lead.id || lead.tempId || ''

    if (lead.userId !== userId) {
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

  // Calcular el estado de la ventana de WhatsApp
  const getWhatsAppWindowStatus = (lead: LocalLead) => {
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

  // Resolver los datos a mostrar en el Drawer
  const invoicesToShow = isForeign
    ? foreignDetails?.invoices || []
    : invoices || []
  const activitiesToShow = isForeign
    ? foreignDetails?.activities || []
    : activities || []
  const dealsToShow = isForeign ? foreignDetails?.deals || [] : deals || []

  return {
    status,
    userId,
    isLeadModalOpen,
    setIsLeadModalOpen,
    leadToEdit,
    setLeadToEdit,
    selectedLeadForInvoice,
    setSelectedLeadForInvoice,
    highlightedActivityId,
    setHighlightedActivityId,
    whatsappTemplates,
    nowTime,
    searchTerm,
    setSearchTerm,
    filterCompanyId,
    setFilterCompanyId,
    companies,
    filteredLeads,
    isSearchingGlobal,
    isLoadingForeign,
    handleDeleteLead,
    getCompanyName,
    getLeadStatus,
    getWhatsAppWindowStatus,
    invoicesToShow,
    activitiesToShow,
    dealsToShow,
  }
}
