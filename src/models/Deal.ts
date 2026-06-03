import mongoose, { Schema, Document } from 'mongoose'

export interface IDealSchema extends Document {
  crmId?: string
  tempId?: string
  leadId: mongoose.Types.ObjectId
  userId: string
  name: string
  amount: number
  termMonths: number
  interestRate: number
  stage: 'draft' | 'under_evaluation' | 'approved' | 'disbursed' | 'completed' | 'refused' | 'overdue'
  notes?: string
  deleted: boolean
  crmSynced: boolean
  crmSyncError?: string
  crmLastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

const DealSchema = new Schema<IDealSchema>(
  {
    crmId: { type: String, unique: true, sparse: true },
    tempId: { type: String, unique: true, sparse: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    termMonths: { type: Number, required: true },
    interestRate: { type: Number, required: true, default: 0 },
    stage: {
      type: String,
      enum: ['draft', 'under_evaluation', 'approved', 'disbursed', 'completed', 'refused', 'overdue'],
      default: 'draft',
      required: true,
    },
    notes: { type: String },
    deleted: { type: Boolean, default: false },
    crmSynced: { type: Boolean, default: false },
    crmSyncError: { type: String },
    crmLastSyncAt: { type: Date },
  },
  { timestamps: true }
)

export default mongoose.models.Deal || mongoose.model<IDealSchema>('Deal', DealSchema)
