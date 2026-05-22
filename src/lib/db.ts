import Dexie, { Table } from 'dexie'

export interface LocalUser {
  id: string // userId de MongoDB
  email: string
  name?: string
  image?: string
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
}

export class PWAResilientDatabase extends Dexie {
  leads!: Table<LocalLead>
  companies!: Table<LocalCompany>
  users!: Table<LocalUser>

  constructor() {
    super('PWAResilientDB')
    
    // Esquema de almacenamiento de IndexedDB
    this.version(2).stores({
      leads: 'tempId, id, userId, synced, deleted, companyId, email',
      companies: 'tempId, id, userId, synced, deleted, name',
      users: 'id, email',
    })
  }
}

export const localDb = new PWAResilientDatabase()
