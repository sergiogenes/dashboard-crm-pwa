import mongoose, { Schema, Document } from 'mongoose'

export interface ILeadSchema extends Document {
  firstName: string
  lastName: string
  email: string
  phone?: string
  companyId?: mongoose.Types.ObjectId | null
  userId: string
  deleted: boolean
  
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
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    userId: { type: String, required: true, index: true },
    deleted: { type: Boolean, default: false, index: true },
    crmId: { type: String, index: true },
    crmSynced: { type: Boolean, default: false, index: true },
    crmSyncError: { type: String },
    crmLastSyncAt: { type: Date },
  },
  { timestamps: true },
)

// Evitar que un mismo usuario tenga leads con correos duplicados
LeadSchema.index({ email: 1, userId: 1 }, { unique: true })

export default mongoose.models.Lead || mongoose.model<ILeadSchema>('Lead', LeadSchema)
