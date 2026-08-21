import mongoose, { Schema, Document } from 'mongoose'
import { encrypt, decrypt } from '@/lib/crypto'

export interface IActivitySchema extends Document {
  crmId?: string
  tempId?: string
  leadId: mongoose.Types.ObjectId
  userId: string
  type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'WHATSAPP'
  title: string
  body: string
  timestamp: Date
  reminderDate?: Date
  reminderRead?: boolean
  reminderStatus?: 'active' | 'waiting' | 'completed'
  reminderPriority?: 'LOW' | 'MEDIUM' | 'HIGH'
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
      enum: ['NOTE', 'CALL', 'MEETING', 'EMAIL', 'TASK', 'WHATSAPP'],
      default: 'NOTE',
      required: true,
    },
    title: { type: String, required: true, get: decrypt, set: encrypt },
    body: { type: String, required: true, get: decrypt, set: encrypt },
    timestamp: { type: Date, required: true, default: Date.now },
    reminderDate: { type: Date },
    // reminderRead se conserva por compatibilidad con datos ya existentes,
    // pero deja de ser la fuente de verdad -- reminderStatus la reemplaza
    // (permite distinguir "leído/en espera" de "realizado", algo que un solo
    // booleano no podía representar).
    reminderRead: { type: Boolean, default: false },
    reminderStatus: {
      type: String,
      enum: ['active', 'waiting', 'completed'],
      default: 'active',
    },
    // Mapea 1:1 con hs_task_priority de HubSpot. Sin selector en la UI
    // todavía -- se deja disponible para cuando se necesite.
    reminderPriority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
    },
    deleted: { type: Boolean, default: false },
    crmSynced: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
)

export default mongoose.models.Activity || mongoose.model<IActivitySchema>('Activity', ActivitySchema)
