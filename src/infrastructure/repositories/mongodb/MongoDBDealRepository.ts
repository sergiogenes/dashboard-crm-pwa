import { IDealRepository } from '@/core/repositories/IDealRepository';
import { Deal } from '@/core/entities/Deal';
import DealModel from '@/models/Deal';
import mongoose from 'mongoose';

export class MongoDBDealRepository implements IDealRepository {
  private toEntity(doc: any): Deal {
    return {
      id: doc._id.toString(),
      crmId: doc.crmId,
      tempId: doc.tempId,
      leadId: doc.leadId.toString(),
      userId: doc.userId,
      name: doc.name,
      amount: doc.amount,
      termMonths: doc.termMonths,
      interestRate: doc.interestRate,
      stage: doc.stage,
      notes: doc.notes,
      deleted: doc.deleted,
      crmSynced: doc.crmSynced,
      crmSyncError: doc.crmSyncError,
      crmLastSyncAt: doc.crmLastSyncAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findById(id: string): Promise<Deal | null> {
    const doc = await DealModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByCrmId(crmId: string): Promise<Deal | null> {
    const doc = await DealModel.findOne({ crmId });
    return doc ? this.toEntity(doc) : null;
  }

  async findByTempId(tempId: string): Promise<Deal | null> {
    const doc = await DealModel.findOne({ tempId });
    return doc ? this.toEntity(doc) : null;
  }

  async findByLeadId(leadId: string): Promise<Deal[]> {
    const docs = await DealModel.find({ leadId: new mongoose.Types.ObjectId(leadId) });
    return docs.map(doc => this.toEntity(doc));
  }

  async findAll(filter: any = {}): Promise<Deal[]> {
    const docs = await DealModel.find(filter);
    return docs.map(doc => this.toEntity(doc));
  }

  async save(deal: Deal): Promise<Deal> {
    const data = {
      crmId: deal.crmId,
      tempId: deal.tempId,
      leadId: new mongoose.Types.ObjectId(deal.leadId),
      userId: deal.userId,
      name: deal.name,
      amount: deal.amount,
      termMonths: deal.termMonths,
      interestRate: deal.interestRate,
      stage: deal.stage,
      notes: deal.notes,
      deleted: deal.deleted,
      crmSynced: deal.crmSynced,
      crmSyncError: deal.crmSyncError,
      crmLastSyncAt: deal.crmLastSyncAt,
    };

    let doc;
    if (deal.id) {
      doc = await DealModel.findByIdAndUpdate(deal.id, data, { new: true });
    } else {
      doc = new DealModel(data);
      await doc.save();
    }
    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await DealModel.findByIdAndUpdate(id, { deleted: true });
    return !!result;
  }
}
