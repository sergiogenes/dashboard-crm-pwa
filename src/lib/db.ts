import Dexie, { Table } from 'dexie'

export interface LocalUser {
  id: string // userId de MongoDB
  email: string
  name?: string
  image?: string
  crmOwnerId?: string
  createdAt: number
}

export interface LocalCompany {
  id?: string // ID real de MongoDB
  tempId?: string // ID temporal para offline
  userId: string // Sesión del usuario
  name: string
  domain?: string
  deleted?: boolean // Soft Delete
  synced: boolean // Estado de sincronización a MongoDB
  createdAt: number
  updatedAt: number
}

export interface LocalLead {
  id?: string // ID real de MongoDB
  tempId?: string // ID temporal para offline
  userId: string // Sesión del usuario
  firstName: string
  lastName: string
  email: string
  phone?: string
  companyId?: string // ID (o tempId) de la empresa asociada
  deleted?: boolean // Soft Delete
  synced: boolean // Estado de sincronización a MongoDB
  createdAt: number
  updatedAt: number
  scoring?: string // Scoring crediticio del lead
  documentId?: string // Cédula de Identidad o DNI
}

export interface LocalInvoice {
  id?: string // ID real de MongoDB
  crmId?: string // ID de la factura (Custom Object) en HubSpot
  leadId: string // ID de MongoDB o tempId del contacto asociado
  userId: string // Sesión del usuario
  amount: number // Monto de la factura
  balanceDue?: number // Saldo pendiente
  status: 'PAID' | 'PENDING' | 'OVERDUE'
  invoiceDate: number // Timestamp de emisión
  dueDate: number // Timestamp de vencimiento
  paymentDate?: number // Timestamp de pago (opcional)
  createdAt: number
  updatedAt: number
}

export interface LocalActivity {
  id?: string // ID real de MongoDB
  tempId?: string // ID temporal para offline
  leadId: string // ID de MongoDB o tempId del contacto asociado
  userId: string // Sesión del usuario
  type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK'
  title: string
  body: string
  timestamp: number // Timestamp de creación/registro
  reminderDate?: number // Timestamp del recordatorio (opcional)
  reminderRead?: boolean // Recordatorio marcado como leído (opcional)
  deleted?: boolean // Soft Delete
  synced: boolean // Estado de sincronización a MongoDB
  createdAt: number
  updatedAt: number
}

export interface LocalNotification {
  id: string // UUID único
  activityId?: string // ID (o tempId) de la actividad
  leadId: string // ID (o tempId) del lead
  userId: string // ID del usuario de la sesión
  title: string // Título del recordatorio
  body: string // Detalles
  scheduledAt: number // Timestamp en el que debe dispararse
  read: boolean // Si ya fue leída en la campanita
  notified: boolean // Si ya disparó la notificación del sistema Web
  createdAt: number
}

export interface LocalDeal {
  id?: string // ID real de MongoDB (ObjectId)
  tempId?: string // ID temporal para offline (UUID)
  leadId: string // ID de MongoDB o tempId del contacto asociado
  userId: string // ID del asesor de la sesión
  name: string // Nombre descriptivo de la solicitud (ej. "Crédito Juan Pérez")
  amount: number // Monto solicitado
  termMonths: number // Plazo en meses (3, 6, 12, 18, 24)
  interestRate: number // Tasa de interés sugerida (%)
  stage:
    | 'draft'
    | 'under_evaluation'
    | 'approved'
    | 'disbursed'
    | 'completed'
    | 'refused'
    | 'overdue'
  notes?: string // Comentarios del asesor
  deleted?: boolean // Soft delete
  synced: boolean // Estado de sincronización local -> MongoDB
  createdAt: number
  updatedAt: number
}

export class PWAResilientDatabase extends Dexie {
  leads!: Table<LocalLead>
  companies!: Table<LocalCompany>
  users!: Table<LocalUser>
  invoices!: Table<LocalInvoice> // Nueva tabla para historial crediticio
  activities!: Table<LocalActivity> // Nueva tabla v4 para actividades
  notifications!: Table<LocalNotification> // Nueva tabla v5 para notificaciones
  deals!: Table<LocalDeal> // Nueva tabla v6 para microcréditos (Deals)

  constructor() {
    super('PWAResilientDB')

    // Esquema de almacenamiento de IndexedDB (versión 4)
    this.version(4).stores({
      leads: 'tempId, id, userId, synced, deleted, companyId, email',
      companies: 'tempId, id, userId, synced, deleted, name',
      users: 'id, email',
      invoices: 'id, crmId, leadId, userId, status',
      activities: 'tempId, id, leadId, userId, type, synced, deleted', // Tabla v4 de actividades
    })

    // Esquema de almacenamiento de IndexedDB (versión 5)
    this.version(5).stores({
      leads: 'tempId, id, userId, synced, deleted, companyId, email',
      companies: 'tempId, id, userId, synced, deleted, name',
      users: 'id, email',
      invoices: 'id, crmId, leadId, userId, status',
      activities: 'tempId, id, leadId, userId, type, synced, deleted',
      notifications:
        'id, userId, read, notified, scheduledAt, activityId, leadId', // Tabla v5 de notificaciones
    })

    // Esquema de almacenamiento de IndexedDB (versión 6)
    this.version(6).stores({
      leads: 'tempId, id, userId, synced, deleted, companyId, email',
      companies: 'tempId, id, userId, synced, deleted, name',
      users: 'id, email',
      invoices: 'id, crmId, leadId, userId, status',
      activities: 'tempId, id, leadId, userId, type, synced, deleted',
      notifications:
        'id, userId, read, notified, scheduledAt, activityId, leadId',
      deals: 'tempId, id, leadId, userId, stage, synced, deleted', // Tabla v6 para microcréditos
    })

    // Esquema de almacenamiento de IndexedDB (versión 7)
    this.version(7).stores({
      leads:
        'tempId, id, userId, synced, deleted, companyId, email, documentId',
      companies: 'tempId, id, userId, synced, deleted, name',
      users: 'id, email',
      invoices: 'id, crmId, leadId, userId, status',
      activities: 'tempId, id, leadId, userId, type, synced, deleted',
      notifications:
        'id, userId, read, notified, scheduledAt, activityId, leadId',
      deals: 'tempId, id, leadId, userId, stage, synced, deleted',
    })
  }
}

export const localDb = new PWAResilientDatabase()

if (typeof window !== 'undefined') {
  ;(window as any).localDb = localDb
}
