import { ILeadRepository } from '@/core/repositories/ILeadRepository';
import { Lead } from '@/core/entities/Lead';
import LeadModel from '@/models/Lead';
import mongoose from 'mongoose';

export class MongoDBLeadRepository implements ILeadRepository {
  private toEntity(doc: any): Lead {
    return {
      id: doc._id.toString(),
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      phone: doc.phone,
      documentId: doc.documentId,
      companyId: doc.companyId ? doc.companyId.toString() : null,
      userId: doc.userId,
      deleted: doc.deleted,
      scoring: doc.scoring,
      crmId: doc.crmId,
      crmSynced: doc.crmSynced,
      crmSyncError: doc.crmSyncError,
      crmLastSyncAt: doc.crmLastSyncAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findById(id: string): Promise<Lead | null> {
    const doc = await LeadModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByDocumentId(documentId: string): Promise<Lead | null> {
    const doc = await LeadModel.findOne({ documentId });
    return doc ? this.toEntity(doc) : null;
  }

  async findByCrmId(crmId: string): Promise<Lead | null> {
    const doc = await LeadModel.findOne({ crmId });
    return doc ? this.toEntity(doc) : null;
  }

  async findAll(filter: any = {}): Promise<Lead[]> {
    const docs = await LeadModel.find(filter);
    return docs.map(doc => this.toEntity(doc));
  }

  async save(lead: Lead): Promise<Lead> {
    const data = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      documentId: lead.documentId,
      companyId: lead.companyId ? new mongoose.Types.ObjectId(lead.companyId) : null,
      userId: lead.userId,
      deleted: lead.deleted,
      scoring: lead.scoring,
      crmId: lead.crmId,
      crmSynced: lead.crmSynced,
      crmSyncError: lead.crmSyncError,
      crmLastSyncAt: lead.crmLastSyncAt,
    };

    let doc;
    if (lead.id) {
      doc = await LeadModel.findByIdAndUpdate(lead.id, data, { new: true });
    } else {
      doc = new LeadModel(data);
      await doc.save();
    }
    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await LeadModel.findByIdAndUpdate(id, { deleted: true });
    return !!result;
  }
}
