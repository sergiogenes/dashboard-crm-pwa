export interface Deal {
  id?: string;
  crmId?: string;
  tempId?: string;
  leadId: string;
  userId: string;
  name: string;
  amount: number;
  termMonths: number;
  interestRate: number;
  stage: 'draft' | 'under_evaluation' | 'approved' | 'disbursed' | 'completed' | 'refused' | 'overdue';
  notes?: string;
  deleted: boolean;
  crmSynced: boolean;
  crmSyncError?: string;
  crmLastSyncAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
