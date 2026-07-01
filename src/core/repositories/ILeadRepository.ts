import { Lead } from '../entities/Lead';

export interface ILeadRepository {
  findById(id: string): Promise<Lead | null>;
  findByDocumentId(documentId: string): Promise<Lead | null>;
  findByCrmId(crmId: string): Promise<Lead | null>;
  findAll(filter?: any): Promise<Lead[]>;
  save(lead: Lead): Promise<Lead>;
  delete(id: string): Promise<boolean>;
}
