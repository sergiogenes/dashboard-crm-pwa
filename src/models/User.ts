import mongoose, { Schema, Document } from 'mongoose'

export interface IUserSchema extends Document {
  name?: string
  email: string
  passwordHash: string
  crmOwnerId?: string
  twoFactorEnabled: boolean
  twoFactorSecret?: string
  twoFactorBackupCodes: string[]
  role: 'admin' | 'user'
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUserSchema>(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    crmOwnerId: { type: String },
    twoFactorEnabled: { type: Boolean, default: false, required: true },
    twoFactorSecret: { type: String },
    twoFactorBackupCodes: { type: [String], default: [] },
    role: { type: String, enum: ['admin', 'user'], default: 'user', required: true },
  },
  { timestamps: true },
)

export default mongoose.models.User || mongoose.model<IUserSchema>('User', UserSchema)
