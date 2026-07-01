'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb, LocalLead } from '@/lib/db'
import { getSalespeople } from '@/app/actions/supervisor'
import { decryptLead } from '@/lib/client-crypto'

export function useDeals() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  // Estados de Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStage, setFilterStage] = useState<string>('ALL')
  const [advisors, setAdvisors] = useState<Record<string, string>>({})

  // Cargar nombres de asesores (vendedores)
  useEffect(() => {
    const fetchAdvisors = async () => {
      try {
        const initialAdvisors: Record<string, string> = {}
        if (userId) {
          initialAdvisors[userId] = session?.user?.name || 'Yo'
        }

        if (session?.user?.roles?.includes('supervisor')) {
          const people = await getSalespeople()
          people.forEach((p) => {
            initialAdvisors[p.id] = p.name
          })
        }
        setAdvisors(initialAdvisors)
      } catch (err) {
        console.error('Error al cargar asesores:', err)
      }
    }

    if (userId) {
      fetchAdvisors()
    }
  }, [userId, session])

  // 1. Obtener reactivamente todas las solicitudes de préstamo (Deals)
  const deals = useLiveQuery(
    async () => {
      if (!userId) return []
      if (session?.user?.roles?.includes('supervisor')) {
        return await localDb.deals.filter((d) => d.deleted !== true).toArray()
      }
      return await localDb.deals
        .filter((d) => d.userId === userId && d.deleted !== true)
        .toArray()
    },
    [userId, session],
    [],
  )

  // 2. Obtener reactivamente todos los Leads locales
  const rawLeads = useLiveQuery(
    async () => {
      if (!userId) return []
      return await localDb.leads.filter((l) => l.deleted !== true).toArray()
    },
    [userId],
    [],
  )

  const [leads, setLeads] = useState<LocalLead[]>([])
  useEffect(() => {
    const decryptAll = async () => {
      if (!rawLeads) {
        setLeads([])
        return
      }
      const dbKey = session?.user?.dbEncryptionKey
      const decrypted = await Promise.all(
        rawLeads.map((l) => decryptLead(l, dbKey))
      )
      setLeads(decrypted)
    }
    decryptAll()
  }, [rawLeads, session])

  // Resolver el nombre del prestatario asociado
  const getBorrowerName = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId || l.tempId === leadId)
    return lead ? `${lead.firstName} ${lead.lastName}` : 'Cargando contacto...'
  }

  // Filtrado y Búsqueda
  const filteredDeals = deals.filter((deal) => {
    const borrower = getBorrowerName(deal.leadId).toLowerCase()
    const matchesSearch =
      borrower.includes(searchTerm.toLowerCase()) ||
      (deal.notes &&
        deal.notes.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStage =
      filterStage === 'ALL' ? true : deal.stage === filterStage

    return matchesSearch && matchesStage
  })

  // Métricas Rápidas
  const totalApplied = deals.reduce((sum, d) => sum + d.amount, 0)
  const activeLoans = deals.filter(
    (d) =>
      d.stage === 'draft' ||
      d.stage === 'under_evaluation' ||
      d.stage === 'approved',
  )
  const totalActiveAmount = activeLoans.reduce((sum, d) => sum + d.amount, 0)

  const disbursedLoans = deals.filter(
    (d) => d.stage === 'disbursed' || d.stage === 'completed',
  )
  const totalDisbursedAmount = disbursedLoans.reduce(
    (sum, d) => sum + d.amount,
    0,
  )

  const overdueCount = deals.filter((d) => d.stage === 'overdue').length

  return {
    status,
    userId,
    session,
    searchTerm,
    setSearchTerm,
    filterStage,
    setFilterStage,
    advisors,
    filteredDeals,
    getBorrowerName,
    totalApplied,
    activeLoans,
    totalActiveAmount,
    disbursedLoans,
    totalDisbursedAmount,
    overdueCount,
    dealsLength: deals.length,
  }
}
