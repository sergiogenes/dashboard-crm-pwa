export interface Lead {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentId?: string;
  companyId?: string | null;
  userId: string;
  deleted: boolean;
  scoring?: string;
  crmId?: string;
  crmSynced: boolean;
  crmSyncError?: string;
  crmLastSyncAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
