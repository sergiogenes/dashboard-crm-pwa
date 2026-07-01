export interface Company {
  id?: string;
  name: string;
  domain?: string;
  userId: string;
  deleted: boolean;
  crmId?: string;
  crmSynced: boolean;
  crmSyncError?: string;
  crmLastSyncAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
