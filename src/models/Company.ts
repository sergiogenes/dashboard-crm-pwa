import mongoose, { Schema, Document } from 'mongoose'

export interface ICompanySchema extends Document {
  name: string
  domain?: string
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

const CompanySchema = new Schema<ICompanySchema>(
  {
    name: { type: String, required: true },
    domain: { type: String },
    userId: { type: String, required: true, index: true },
    deleted: { type: Boolean, default: false, index: true },
    crmId: { type: String, index: true },
    crmSynced: { type: Boolean, default: false, index: true },
    crmSyncError: { type: String },
    crmLastSyncAt: { type: Date },
  },
  { timestamps: true },
)

export default mongoose.models.Company || mongoose.model<ICompanySchema>('Company', CompanySchema)
