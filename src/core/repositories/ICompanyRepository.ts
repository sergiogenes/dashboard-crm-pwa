import { Company } from '../entities/Company';

export interface ICompanyRepository {
  findById(id: string): Promise<Company | null>;
  findByCrmId(crmId: string): Promise<Company | null>;
  findAll(filter?: any): Promise<Company[]>;
  save(company: Company): Promise<Company>;
  delete(id: string): Promise<boolean>;
}
