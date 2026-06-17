export interface Invoice {
  id?: string;
  crmId?: string;
  leadId: string;
  userId: string;
  amount: number;
  balanceDue?: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  invoiceDate: Date;
  dueDate: Date;
  paymentDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
