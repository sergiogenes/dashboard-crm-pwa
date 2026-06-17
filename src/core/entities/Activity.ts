export interface Activity {
  id?: string;
  crmId?: string;
  tempId?: string;
  leadId: string;
  userId: string;
  type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'WHATSAPP';
  title: string;
  body: string;
  timestamp: Date;
  reminderDate?: Date;
  reminderRead?: boolean;
  deleted: boolean;
  crmSynced: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
