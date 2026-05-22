import mongoose, { Schema, Document } from 'mongoose'

export interface IUserSchema extends Document {
  name?: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUserSchema>(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
)

export default mongoose.models.User || mongoose.model<IUserSchema>('User', UserSchema)
