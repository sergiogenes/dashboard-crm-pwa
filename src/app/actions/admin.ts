'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'

// Helper para verificar el rol de administrador
async function getAdminIdOrThrow() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.roles?.includes('admin')) {
    throw new Error('No autorizado. Se requiere el rol de administrador.')
  }
  return session.user.id
}

/**
 * Obtiene todos los usuarios, supervisores y vendedores en el sistema
 */
export async function getAdminUserData() {
  await getAdminIdOrThrow()
  await dbConnect()

  const allUsers = await User.find({}).sort({ name: 1 })
  const userList = allUsers.map((u) => {
    // Buscar el nombre del supervisor si tiene uno asignado
    const supervisor = u.supervisorId
      ? allUsers.find((sup) => String(sup._id) === u.supervisorId)
      : null

    const rolesList = u.roles && u.roles.length > 0 ? u.roles : [u.role || 'user']

    return {
      id: u._id.toString(),
      name: u.name || 'Sin Nombre',
      email: u.email,
      roles: rolesList,
      supervisorId: u.supervisorId || null,
      supervisorName: supervisor ? supervisor.name || supervisor.email : null,
      crmOwnerId: u.crmOwnerId || null,
    }
  })

  const supervisors = userList.filter((u) => u.roles.includes('supervisor'))
  const salespeople = userList.filter((u) => u.roles.includes('user'))

  return {
    users: userList,
    supervisors,
    salespeople,
  }
}

/**
 * Actualiza los roles de un usuario
 */
export async function updateUserRoles(
  userId: string,
  roles: ('admin' | 'supervisor' | 'user')[],
) {
  await getAdminIdOrThrow()
  await dbConnect()

  if (roles.length === 0) {
    throw new Error('Un usuario debe poseer al menos un rol')
  }

  const targetUser = await User.findById(userId)
  if (!targetUser) {
    throw new Error('Usuario no encontrado')
  }

  const oldRoles = targetUser.roles && targetUser.roles.length > 0 
    ? targetUser.roles 
    : [targetUser.role || 'user']
  
  targetUser.roles = roles
  // Eliminar propiedad deprecated para evitar inconsistencias
  targetUser.set('role', undefined)

  // Si el usuario deja de ser supervisor, removemos su id como supervisor de cualquier vendedor
  const wasSupervisor = oldRoles.includes('supervisor')
  const isSupervisor = roles.includes('supervisor')
  if (wasSupervisor && !isSupervisor) {
    await User.updateMany(
      { supervisorId: userId },
      { $unset: { supervisorId: '' } },
    )
  }

  // Si pasa a no ser vendedor (user), le limpiamos su propio supervisor si lo tenía
  if (!roles.includes('user')) {
    targetUser.supervisorId = undefined
  }

  await targetUser.save()
  return { success: true }
}

/**
 * Asigna de forma masiva un grupo de vendedores a un supervisor
 */
export async function assignSalespeopleToSupervisor(
  supervisorId: string,
  salespeopleIds: string[],
) {
  await getAdminIdOrThrow()
  await dbConnect()

  const supervisor = await User.findOne({
    _id: supervisorId,
    $or: [{ roles: 'supervisor' }, { role: 'supervisor' }],
  })
  if (!supervisor) {
    throw new Error('El supervisor seleccionado no es válido o no existe')
  }

  // 1. Asignar el supervisorId a los vendedores seleccionados
  if (salespeopleIds.length > 0) {
    await User.updateMany(
      { _id: { $in: salespeopleIds }, $or: [{ roles: 'user' }, { role: 'user' }] },
      { $set: { supervisorId } },
    )
  }

  // 2. Desvincular a los vendedores que antes pertenecían a este supervisor pero que ya no fueron seleccionados
  await User.updateMany(
    { supervisorId, _id: { $nin: salespeopleIds } },
    { $unset: { supervisorId: '' } },
  )

  return { success: true }
}
