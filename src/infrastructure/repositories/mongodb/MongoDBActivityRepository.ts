import { IActivityRepository } from '@/core/repositories/IActivityRepository';
import { Activity } from '@/core/entities/Activity';
import ActivityModel from '@/models/Activity';
import mongoose from 'mongoose';

export class MongoDBActivityRepository implements IActivityRepository {
  private toEntity(doc: any): Activity {
    return {
      id: doc._id.toString(),
      crmId: doc.crmId,
      tempId: doc.tempId,
      leadId: doc.leadId.toString(),
      userId: doc.userId,
      type: doc.type,
      title: doc.title,
      body: doc.body,
      timestamp: doc.timestamp,
      reminderDate: doc.reminderDate,
      reminderRead: doc.reminderRead,
      deleted: doc.deleted,
      crmSynced: doc.crmSynced,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findById(id: string): Promise<Activity | null> {
    const doc = await ActivityModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByCrmId(crmId: string): Promise<Activity | null> {
    const doc = await ActivityModel.findOne({ crmId });
    return doc ? this.toEntity(doc) : null;
  }

  async findByTempId(tempId: string): Promise<Activity | null> {
    const doc = await ActivityModel.findOne({ tempId });
    return doc ? this.toEntity(doc) : null;
  }

  async findByLeadId(leadId: string): Promise<Activity[]> {
    const docs = await ActivityModel.find({ leadId: new mongoose.Types.ObjectId(leadId) });
    return docs.map(doc => this.toEntity(doc));
  }

  async findAll(filter: any = {}): Promise<Activity[]> {
    const docs = await ActivityModel.find(filter);
    return docs.map(doc => this.toEntity(doc));
  }

  async save(activity: Activity): Promise<Activity> {
    const data = {
      crmId: activity.crmId,
      tempId: activity.tempId,
      leadId: new mongoose.Types.ObjectId(activity.leadId),
      userId: activity.userId,
      type: activity.type,
      title: activity.title,
      body: activity.body,
      timestamp: activity.timestamp,
      reminderDate: activity.reminderDate,
      reminderRead: activity.reminderRead,
      deleted: activity.deleted,
      crmSynced: activity.crmSynced,
    };

    let doc;
    if (activity.id) {
      doc = await ActivityModel.findByIdAndUpdate(activity.id, data, { new: true });
    } else {
      doc = new ActivityModel(data);
      await doc.save();
    }
    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await ActivityModel.findByIdAndUpdate(id, { deleted: true });
    return !!result;
  }
}
