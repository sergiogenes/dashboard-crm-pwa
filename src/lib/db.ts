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
  id?: string          // ID real de MongoDB
  tempId?: string      // ID temporal para offline
  userId: string       // Sesión del usuario
  name: string
  domain?: string
  deleted?: boolean    // Soft Delete
  synced: boolean      // Estado de sincronización a MongoDB
  createdAt: number
  updatedAt: number
}

export interface LocalLead {
  id?: string          // ID real de MongoDB
  tempId?: string      // ID temporal para offline
  userId: string       // Sesión del usuario
  firstName: string
  lastName: string
  email: string
  phone?: string
  companyId?: string   // ID (o tempId) de la empresa asociada
  deleted?: boolean    // Soft Delete
  synced: boolean      // Estado de sincronización a MongoDB
  createdAt: number
  updatedAt: number
  scoring?: string     // Scoring crediticio del lead
}

export interface LocalInvoice {
  id?: string          // ID real de MongoDB
  crmId?: string       // ID de la factura (Custom Object) en HubSpot
  leadId: string       // ID de MongoDB o tempId del contacto asociado
  userId: string       // Sesión del usuario
  amount: number       // Monto de la factura
  status: 'PAID' | 'PENDING' | 'OVERDUE'
  invoiceDate: number  // Timestamp de emisión
  dueDate: number      // Timestamp de vencimiento
  paymentDate?: number // Timestamp de pago (opcional)
  createdAt: number
  updatedAt: number
}

export class PWAResilientDatabase extends Dexie {
  leads!: Table<LocalLead>
  companies!: Table<LocalCompany>
  users!: Table<LocalUser>
  invoices!: Table<LocalInvoice> // Nueva tabla para historial crediticio

  constructor() {
    super('PWAResilientDB')
    
    // Esquema de almacenamiento de IndexedDB (versión 3)
    this.version(3).stores({
      leads: 'tempId, id, userId, synced, deleted, companyId, email',
      companies: 'tempId, id, userId, synced, deleted, name',
      users: 'id, email',
      invoices: 'id, crmId, leadId, userId, status', // Índice por ID de lead y estado
    })
  }
}

export const localDb = new PWAResilientDatabase()
