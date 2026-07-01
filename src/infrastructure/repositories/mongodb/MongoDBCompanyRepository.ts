import { ICompanyRepository } from '@/core/repositories/ICompanyRepository';
import { Company } from '@/core/entities/Company';
import CompanyModel from '@/models/Company';

export class MongoDBCompanyRepository implements ICompanyRepository {
  private toEntity(doc: any): Company {
    return {
      id: doc._id.toString(),
      name: doc.name,
      domain: doc.domain,
      userId: doc.userId,
      deleted: doc.deleted,
      crmId: doc.crmId,
      crmSynced: doc.crmSynced,
      crmSyncError: doc.crmSyncError,
      crmLastSyncAt: doc.crmLastSyncAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findById(id: string): Promise<Company | null> {
    const doc = await CompanyModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByCrmId(crmId: string): Promise<Company | null> {
    const doc = await CompanyModel.findOne({ crmId });
    return doc ? this.toEntity(doc) : null;
  }

  async findAll(filter: any = {}): Promise<Company[]> {
    const docs = await CompanyModel.find(filter);
    return docs.map(doc => this.toEntity(doc));
  }

  async save(company: Company): Promise<Company> {
    const data = {
      name: company.name,
      domain: company.domain,
      userId: company.userId,
      deleted: company.deleted,
      crmId: company.crmId,
      crmSynced: company.crmSynced,
      crmSyncError: company.crmSyncError,
      crmLastSyncAt: company.crmLastSyncAt,
    };

    let doc;
    if (company.id) {
      doc = await CompanyModel.findByIdAndUpdate(company.id, data, { new: true });
    } else {
      doc = new CompanyModel(data);
      await doc.save();
    }
    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await CompanyModel.findByIdAndUpdate(id, { deleted: true });
    return !!result;
  }
}
