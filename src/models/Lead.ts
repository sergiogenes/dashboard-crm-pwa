import mongoose, { Schema, Document } from 'mongoose'
import { encrypt, decrypt, hash } from '@/lib/crypto'

export interface ILeadSchema extends Document {
  firstName: string
  lastName: string
  email: string
  phone?: string
  documentId?: string
  emailHash?: string
  documentIdHash?: string
  companyId?: mongoose.Types.ObjectId | null
  userId: string
  deleted: boolean
  scoring?: string

  // Metadatos de sincronización con el CRM
  crmId?: string
  crmSynced: boolean
  crmSyncError?: string
  crmLastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

const LeadSchema = new Schema<ILeadSchema>(
  {
    firstName: { type: String, required: true, get: decrypt, set: encrypt },
    lastName: { type: String, required: true, get: decrypt, set: encrypt },
    email: { type: String, required: true, get: decrypt, set: encrypt },
    phone: { type: String, get: decrypt, set: encrypt },
    documentId: { type: String, get: decrypt, set: encrypt },
    emailHash: { type: String, index: true },
    documentIdHash: { type: String },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    userId: { type: String, required: true, index: true },
    deleted: { type: Boolean, default: false, index: true },
    scoring: { type: String },
    crmId: { type: String, index: true },
    crmSynced: { type: Boolean, default: false, index: true },
    crmSyncError: { type: String },
    crmLastSyncAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
)

// Middleware para poblar hashes automáticamente antes de validar
LeadSchema.pre('validate', function () {
  if (this.email) {
    this.emailHash = hash(this.email)
  }
  if (this.documentId) {
    this.documentIdHash = hash(this.documentId)
  }
})

// Middleware para findOneAndUpdate
LeadSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as any
  if (update) {
    if (update.$set) {
      if (update.$set.email) update.$set.emailHash = hash(update.$set.email)
      if (update.$set.documentId) update.$set.documentIdHash = hash(update.$set.documentId)
    } else {
      if (update.email) update.emailHash = hash(update.email)
      if (update.documentId) update.documentIdHash = hash(update.documentId)
    }
  }
})

// Evitar que un mismo usuario tenga leads con correos duplicados (basado en el hash)
LeadSchema.index({ emailHash: 1, userId: 1 }, { unique: true })

// Índice único disperso para el DNI (basado en el hash)
LeadSchema.index({ documentIdHash: 1 }, { unique: true, sparse: true })

export default mongoose.models.Lead ||
  mongoose.model<ILeadSchema>('Lead', LeadSchema)
