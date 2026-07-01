import { Activity } from '../entities/Activity';

export interface IActivityRepository {
  findById(id: string): Promise<Activity | null>;
  findByCrmId(crmId: string): Promise<Activity | null>;
  findByTempId(tempId: string): Promise<Activity | null>;
  findByLeadId(leadId: string): Promise<Activity[]>;
  findAll(filter?: any): Promise<Activity[]>;
  save(activity: Activity): Promise<Activity>;
  delete(id: string): Promise<boolean>;
}
