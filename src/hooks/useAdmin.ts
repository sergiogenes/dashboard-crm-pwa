'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getAdminUserData,
  updateUserRoles,
  assignSalespeopleToSupervisor,
} from '@/app/actions/admin'

export interface AdminUser {
  id: string
  name: string
  email: string
  roles: ('admin' | 'supervisor' | 'user')[]
  supervisorId: string | null
  supervisorName: string | null
  crmOwnerId: string | null
}

export function useAdmin() {
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [supervisors, setSupervisors] = useState<AdminUser[]>([])
  const [salespeople, setSalespeople] = useState<AdminUser[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('')
  const [assignedSalespeopleIds, setAssignedSalespeopleIds] = useState<
    string[]
  >([])

  // Cargar datos de administración
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAdminUserData()
      setUsers(data.users as AdminUser[])
      setSupervisors(data.supervisors as AdminUser[])
      setSalespeople(data.salespeople as AdminUser[])

      // Auto-seleccionar primer supervisor si existe
      if (data.supervisors.length > 0) {
        setSelectedSupervisorId((prev) => {
          if (!prev) {
            const supId = data.supervisors[0].id
            const currentAssigned = (data.salespeople as AdminUser[])
              .filter((s) => s.supervisorId === supId)
              .map((s) => s.id)
            setAssignedSalespeopleIds(currentAssigned)
            return supId
          }
          return prev
        })
      }
    } catch (err) {
      console.error('Error al cargar datos de administración:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Seleccionar supervisor y cargar sus vendedores actuales
  const handleSelectSupervisor = (
    supId: string,
    currentSalespeople = salespeople,
  ) => {
    setSelectedSupervisorId(supId)
    const currentAssigned = currentSalespeople
      .filter((s) => s.supervisorId === supId)
      .map((s) => s.id)
    setAssignedSalespeopleIds(currentAssigned)
  }

  // Alternar un rol específico en la lista de roles del usuario
  const handleRoleToggle = async (
    userId: string,
    currentRoles: ('admin' | 'supervisor' | 'user')[],
    roleToToggle: 'admin' | 'supervisor' | 'user',
  ) => {
    try {
      setActionLoading(true)
      let newRoles: ('admin' | 'supervisor' | 'user')[]

      if (currentRoles.includes(roleToToggle)) {
        if (currentRoles.length === 1) {
          alert('Un usuario debe tener al menos un rol asignado.')
          return
        }
        newRoles = currentRoles.filter((r) => r !== roleToToggle)
      } else {
        newRoles = [...currentRoles, roleToToggle]
      }

      await updateUserRoles(userId, newRoles)
      alert('Roles actualizados correctamente.')

      // Recargar datos para refrescar las tablas
      await loadData()
    } catch (err: any) {
      alert(`Error al actualizar roles: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Alternar checkbox de vendedor asignado
  const toggleSalespersonAssign = (id: string) => {
    if (assignedSalespeopleIds.includes(id)) {
      setAssignedSalespeopleIds(assignedSalespeopleIds.filter((x) => x !== id))
    } else {
      setAssignedSalespeopleIds([...assignedSalespeopleIds, id])
    }
  }

  // Guardar asignaciones del supervisor
  const handleSaveAssignments = async () => {
    if (!selectedSupervisorId) return

    try {
      setActionLoading(true)
      await assignSalespeopleToSupervisor(
        selectedSupervisorId,
        assignedSalespeopleIds,
      )
      alert(
        'Asignaciones de vendedores actualizadas correctamente en la base de datos.',
      )
      await loadData()
    } catch (err: any) {
      alert(`Error al guardar asignaciones: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Filtrar lista de usuarios por buscador
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase()
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.roles.some((r) => r.toLowerCase().includes(term))
    )
  })

  return {
    loading,
    actionLoading,
    users,
    supervisors,
    salespeople,
    searchTerm,
    setSearchTerm,
    selectedSupervisorId,
    assignedSalespeopleIds,
    handleSelectSupervisor,
    handleRoleToggle,
    toggleSalespersonAssign,
    handleSaveAssignments,
    filteredUsers,
  }
}
