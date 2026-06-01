import mongoose, { Schema, Document } from 'mongoose'

export interface IInvoiceSchema extends Document {
  crmId?: string
  leadId: mongoose.Types.ObjectId
  userId: string
  amount: number
  status: 'PAID' | 'PENDING' | 'OVERDUE'
  invoiceDate: Date
  dueDate: Date
  paymentDate?: Date
  createdAt: Date
  updatedAt: Date
}

const InvoiceSchema = new Schema<IInvoiceSchema>(
  {
    crmId: { type: String, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['PAID', 'PENDING', 'OVERDUE'], required: true, index: true },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    paymentDate: { type: Date },
  },
  { timestamps: true }
)

export default mongoose.models.Invoice || mongoose.model<IInvoiceSchema>('Invoice', InvoiceSchema)
