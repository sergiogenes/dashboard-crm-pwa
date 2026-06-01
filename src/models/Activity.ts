import mongoose, { Schema, Document } from 'mongoose'

export interface IActivitySchema extends Document {
  crmId?: string
  tempId?: string
  leadId: mongoose.Types.ObjectId
  userId: string
  type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK'
  title: string
  body: string
  timestamp: Date
  reminderDate?: Date
  deleted: boolean
  crmSynced: boolean
  createdAt: Date
  updatedAt: Date
}

const ActivitySchema = new Schema<IActivitySchema>(
  {
    crmId: { type: String, unique: true, sparse: true },
    tempId: { type: String, unique: true, sparse: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    userId: { type: String, required: true },
    type: {
      type: String,
      enum: ['NOTE', 'CALL', 'MEETING', 'EMAIL', 'TASK'],
      default: 'NOTE',
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    reminderDate: { type: Date },
    deleted: { type: Boolean, default: false },
    crmSynced: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export default mongoose.models.Activity || mongoose.model<IActivitySchema>('Activity', ActivitySchema)
