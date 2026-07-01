import { Deal } from '../entities/Deal';

export interface IDealRepository {
  findById(id: string): Promise<Deal | null>;
  findByCrmId(crmId: string): Promise<Deal | null>;
  findByTempId(tempId: string): Promise<Deal | null>;
  findByLeadId(leadId: string): Promise<Deal[]>;
  findAll(filter?: any): Promise<Deal[]>;
  save(deal: Deal): Promise<Deal>;
  delete(id: string): Promise<boolean>;
}
