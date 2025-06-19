import mongoose, { Model } from 'mongoose';
import { ErrorUtil } from '../middleware/ErrorUtil';

export interface PaginationOptions {
  filters: Array<object>;
  sort: Record<string, 1 | -1>;
  query: Array<object>;
  page: number;
  limit: number;
}

export class CRUDHandler<T extends mongoose.Document> {
  protected Schema: Model<T>;

  constructor(schema: Model<T>) {
    this.Schema = schema;
  }

  async create(data: any): Promise<T> {
    await this.beforeCreate(data);
    const result = await this.Schema.create(data);
    await this.afterCreate(result);
    return result;
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: T[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query.length > 0 && { $or: options.query }),
        },
      },
      {
        $sort: options.sort,
      },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [{ $skip: (options.page - 1) * options.limit }, { $limit: options.limit }],
        },
      },
    ]);
  }

  async fetch(id: string): Promise<any | null> {
    return await this.Schema.findById(id).lean();
  }

  async update(id: string, data: any): Promise<T | null> {
    await this.beforeUpdate(id, data);
    const updated = await this.Schema.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    await this.afterUpdate(updated);
    return updated;
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.beforeDelete(id);
    const result = await this.Schema.findByIdAndDelete(id);
    await this.afterDelete(result);
    return { success: true };
  }

  // === HOOK POINTS ===

  protected async beforeCreate(data: any): Promise<void> {}
  protected async afterCreate(doc: T): Promise<void> {}

  protected async beforeUpdate(id: string, data: any): Promise<void> {}
  protected async afterUpdate(doc: T | null): Promise<void> {}

  protected async beforeDelete(id: string): Promise<void> {}
  protected async afterDelete(doc: T | null): Promise<void> {}
}
