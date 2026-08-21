'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import Lead from '@/models/Lead'
import Deal from '@/models/Deal'
import { hash } from '@/lib/crypto'
import {
  isValidEmail,
  isValidParaguayanDocumentId,
  isValidPhone,
} from '@/lib/validation'

// Helper para validar rol de supervisor
async function getSupervisorIdOrThrow() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.roles?.includes('supervisor')) {
    throw new Error('No autorizado. Se requiere el rol de supervisor.')
  }
  return session.user.id
}

/**
 * Obtiene las estadísticas consolidadas del equipo del supervisor
 */
export async function getSupervisorDashboardData() {
  const supervisorId = await getSupervisorIdOrThrow()
  await dbConnect()

  // 1. Obtener datos del supervisor
  const supervisor = await User.findById(supervisorId)
  if (!supervisor) {
    throw new Error('Supervisor no encontrado')
  }

  const disbursementGoal = supervisor.disbursementGoal || 100000

  // 2. Obtener todos los vendedores a cargo
  const salespeople = await User.find({
    supervisorId,
    $or: [{ roles: 'user' }, { role: 'user' }],
  })
  const salespeopleIds = salespeople.map((s) => String(s._id))

  // 3. Obtener deals del equipo
  const teamDeals = await Deal.find({
    userId: { $in: salespeopleIds },
    deleted: { $ne: true },
  })

  // 4. Calcular métricas consolidadas
  let totalDisbursed = 0
  let totalOperations = teamDeals.length
  let pendingApprovalCount = 0

  for (const deal of teamDeals) {
    if (deal.stage === 'disbursed' || deal.stage === 'completed') {
      totalDisbursed += deal.amount
    }
    if (deal.stage === 'under_evaluation' || deal.stage === 'approved') {
      pendingApprovalCount++
    }
  }

  // 5. Consolidar el rendimiento individual por vendedor
  const salespeoplePerformance = salespeople.map((sp) => {
    const spIdStr = String(sp._id)
    const spDeals = teamDeals.filter((d) => String(d.userId) === spIdStr)

    let spDisbursed = 0
    let spPendingApproval = 0

    for (const d of spDeals) {
      if (d.stage === 'disbursed' || d.stage === 'completed') {
        spDisbursed += d.amount
      }
      if (d.stage === 'under_evaluation' || d.stage === 'approved') {
        spPendingApproval++
      }
    }

    return {
      id: spIdStr,
      name: sp.name || 'Sin Nombre',
      email: sp.email,
      crmOwnerId: sp.crmOwnerId || '-',
      totalDisbursed: spDisbursed,
      totalDeals: spDeals.length,
      pendingDeals: spPendingApproval,
    }
  })

  // 6. Obtener prospectos cargados por el supervisor que aún no tienen dueño (userId === supervisorId)
  const supervisorLeads = await Lead.find({
    userId: supervisorId,
    deleted: { $ne: true },
  }).sort({ createdAt: -1 })

  const mappedLeads = supervisorLeads.map((l) => ({
    id: l._id.toString(),
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    phone: l.phone,
    documentId: l.documentId,
    scoring: l.scoring,
    crmSynced: l.crmSynced,
    createdAt: l.createdAt.getTime(),
  }))

  return {
    disbursementGoal,
    totalDisbursed,
    totalOperations,
    pendingApprovalCount,
    salespeople: salespeoplePerformance,
    prospects: mappedLeads,
  }
}

/**
 * Actualiza el objetivo de desembolsos del supervisor
 */
export async function updateDisbursementGoal(goal: number) {
  const supervisorId = await getSupervisorIdOrThrow()
  await dbConnect()

  if (goal <= 0) {
    throw new Error('El objetivo debe ser mayor a cero')
  }

  await User.findByIdAndUpdate(supervisorId, {
    disbursementGoal: goal,
  })

  return { success: true }
}

/**
 * Obtiene el listado simple de vendedores a cargo
 */
export async function getSalespeople() {
  const supervisorId = await getSupervisorIdOrThrow()
  await dbConnect()

  const salespeople = await User.find(
    {
      supervisorId,
      $or: [{ roles: 'user' }, { role: 'user' }],
    },
    'name email crmOwnerId',
  )
  return salespeople.map((s) => ({
    id: s._id.toString(),
    name: s.name || 'Sin Nombre',
    email: s.email,
    crmOwnerId: s.crmOwnerId,
  }))
}

/**
 * Importa prospectos desde una lista validada de un archivo CSV
 */
export async function importProspectsFromCSV(
  prospects: Array<{
    documentId: string
    firstName: string
    lastName: string
    email: string
    phone?: string
  }>,
) {
  const supervisorId = await getSupervisorIdOrThrow()
  await dbConnect()

  let importedCount = 0
  let skippedCount = 0
  const errors: string[] = []

  for (const p of prospects) {
    const docId = p.documentId?.trim()
    const email = p.email?.trim().toLowerCase()
    const firstName = p.firstName?.trim()
    const lastName = p.lastName?.trim()
    const phone = p.phone?.trim()
    const displayName = `${firstName || 'Sin nombre'} ${lastName || ''}`.trim()

    if (!docId || !email || !firstName || !lastName) {
      skippedCount++
      errors.push(`Campos incompletos para: ${displayName}`)
      continue
    }

    // El teléfono sigue siendo opcional (igual que en el alta manual de un
    // contacto), pero si viene con datos, tiene que ser un número válido.
    // El email es obligatorio y también se valida su formato.
    if (!isValidEmail(email)) {
      skippedCount++
      errors.push(`Email inválido para ${displayName}: "${p.email}"`)
      continue
    }

    if (phone && !isValidPhone(phone)) {
      skippedCount++
      errors.push(`Teléfono inválido para ${displayName}: "${p.phone}"`)
      continue
    }

    if (!isValidParaguayanDocumentId(docId)) {
      skippedCount++
      errors.push(
        `Cédula/DNI inválida para ${displayName}: "${p.documentId}" (debe tener entre 5 y 9 dígitos)`,
      )
      continue
    }

    try {
      // Validar si ya existe un lead activo en la base de datos por DNI o Email
      const existingLead = await Lead.findOne({
        $or: [{ documentIdHash: hash(docId) }, { emailHash: hash(email) }],
        deleted: { $ne: true },
      })

      if (existingLead) {
        skippedCount++
        continue // Se salta por duplicado
      }

      // Crear nuevo prospecto asociado inicialmente al supervisor
      await Lead.create({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        documentId: docId,
        userId: supervisorId,
        crmSynced: false,
        deleted: false,
      })

      importedCount++
    } catch (err: any) {
      skippedCount++
      errors.push(`Error al insertar ${firstName} ${lastName}: ${err.message}`)
    }
  }

  return {
    success: true,
    importedCount,
    skippedCount,
    errors,
  }
}

/**
 * Asigna un lead (prospecto) a un vendedor específico
 */
export async function assignLeadToSalesperson(
  leadId: string,
  salespersonId: string,
) {
  const supervisorId = await getSupervisorIdOrThrow()
  await dbConnect()

  // 1. Validar que el vendedor esté a cargo de este supervisor
  const salesperson = await User.findOne({
    _id: salespersonId,
    supervisorId,
    $or: [{ roles: 'user' }, { role: 'user' }],
  })

  if (!salesperson) {
    throw new Error('El vendedor no pertenece a tu equipo de trabajo')
  }

  // 2. Validar que el lead le pertenezca actualmente al supervisor
  const lead = await Lead.findOne({
    _id: leadId,
    userId: supervisorId,
    deleted: { $ne: true },
  })

  if (!lead) {
    throw new Error('El lead no pertenece a tus prospectos o ya fue asignado')
  }

  // 3. Reasignar localmente en MongoDB y marcar como no sincronizado con el CRM
  lead.userId = salespersonId
  lead.crmSynced = false
  await lead.save()

  // Nota: Al marcar crmSynced = false, el motor de sincronización (Outbound Engine)
  // actualizará en su siguiente ciclo el propietario (hubspot_owner_id) en HubSpot
  // utilizando el crmOwnerId del vendedor correspondiente de forma nativa.

  return { success: true }
}
