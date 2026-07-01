import { ICompanyRepository } from '@/core/repositories/ICompanyRepository';
import { ILeadRepository } from '@/core/repositories/ILeadRepository';
import { IActivityRepository } from '@/core/repositories/IActivityRepository';
import { IDealRepository } from '@/core/repositories/IDealRepository';
import { IInvoiceRepository } from '@/core/repositories/IInvoiceRepository';

import { MongoDBCompanyRepository } from './mongodb/MongoDBCompanyRepository';
import { MongoDBLeadRepository } from './mongodb/MongoDBLeadRepository';
import { MongoDBActivityRepository } from './mongodb/MongoDBActivityRepository';
import { MongoDBDealRepository } from './mongodb/MongoDBDealRepository';
import { MongoDBInvoiceRepository } from './mongodb/MongoDBInvoiceRepository';

export class RepositoryFactory {
  private static companyRepo: ICompanyRepository;
  private static leadRepo: ILeadRepository;
  private static activityRepo: IActivityRepository;
  private static dealRepo: IDealRepository;
  private static invoiceRepo: IInvoiceRepository;

  static getCompanyRepository(): ICompanyRepository {
    if (!this.companyRepo) {
      this.companyRepo = new MongoDBCompanyRepository();
    }
    return this.companyRepo;
  }

  static getLeadRepository(): ILeadRepository {
    if (!this.leadRepo) {
      this.leadRepo = new MongoDBLeadRepository();
    }
    return this.leadRepo;
  }

  static getActivityRepository(): IActivityRepository {
    if (!this.activityRepo) {
      this.activityRepo = new MongoDBActivityRepository();
    }
    return this.activityRepo;
  }

  static getDealRepository(): IDealRepository {
    if (!this.dealRepo) {
      this.dealRepo = new MongoDBDealRepository();
    }
    return this.dealRepo;
  }

  static getInvoiceRepository(): IInvoiceRepository {
    if (!this.invoiceRepo) {
      this.invoiceRepo = new MongoDBInvoiceRepository();
    }
    return this.invoiceRepo;
  }
}
