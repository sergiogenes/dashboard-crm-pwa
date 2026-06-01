import mongoose, { Schema, Document } from 'mongoose'

export interface IPasswordResetTokenSchema extends Document {
  userId: mongoose.Types.ObjectId
  tokenHash: string
  expiresAt: Date
  createdAt: Date
}

const PasswordResetTokenSchema = new Schema<IPasswordResetTokenSchema>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // MongoDB TTL index
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export default mongoose.models.PasswordResetToken || 
  mongoose.model<IPasswordResetTokenSchema>('PasswordResetToken', PasswordResetTokenSchema)
