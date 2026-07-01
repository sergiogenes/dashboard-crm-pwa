import { Invoice } from '../entities/Invoice';

export interface IInvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByCrmId(crmId: string): Promise<Invoice | null>;
  findByLeadId(leadId: string): Promise<Invoice[]>;
  findAll(filter?: any): Promise<Invoice[]>;
  save(invoice: Invoice): Promise<Invoice>;
  delete(id: string): Promise<boolean>;
}
