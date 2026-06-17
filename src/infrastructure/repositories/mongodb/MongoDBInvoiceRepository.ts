import { IInvoiceRepository } from '@/core/repositories/IInvoiceRepository';
import { Invoice } from '@/core/entities/Invoice';
import InvoiceModel from '@/models/Invoice';
import mongoose from 'mongoose';

export class MongoDBInvoiceRepository implements IInvoiceRepository {
  private toEntity(doc: any): Invoice {
    return {
      id: doc._id.toString(),
      crmId: doc.crmId,
      leadId: doc.leadId.toString(),
      userId: doc.userId,
      amount: doc.amount,
      balanceDue: doc.balanceDue,
      status: doc.status,
      invoiceDate: doc.invoiceDate,
      dueDate: doc.dueDate,
      paymentDate: doc.paymentDate,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findById(id: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByCrmId(crmId: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findOne({ crmId });
    return doc ? this.toEntity(doc) : null;
  }

  async findByLeadId(leadId: string): Promise<Invoice[]> {
    const docs = await InvoiceModel.find({ leadId: new mongoose.Types.ObjectId(leadId) });
    return docs.map(doc => this.toEntity(doc));
  }

  async findAll(filter: any = {}): Promise<Invoice[]> {
    const docs = await InvoiceModel.find(filter);
    return docs.map(doc => this.toEntity(doc));
  }

  async save(invoice: Invoice): Promise<Invoice> {
    const data = {
      crmId: invoice.crmId,
      leadId: new mongoose.Types.ObjectId(invoice.leadId),
      userId: invoice.userId,
      amount: invoice.amount,
      balanceDue: invoice.balanceDue,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      paymentDate: invoice.paymentDate,
    };

    let doc;
    if (invoice.id) {
      doc = await InvoiceModel.findByIdAndUpdate(invoice.id, data, { new: true });
    } else {
      doc = new InvoiceModel(data);
      await doc.save();
    }
    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await InvoiceModel.findByIdAndDelete(id);
    return !!result;
  }
}
