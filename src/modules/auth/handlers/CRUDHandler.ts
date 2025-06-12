import mongoose, { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import User from '../model/User'; // Only needed if cross-checking users like features are

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
    return await this.Schema.create(data);
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: T[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...options.query,
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

  async fetch(id: string): Promise<T | null> {
    return await this.Schema.findById(id);
  }

  async update(id: string, data: any): Promise<T | null> {
    return await this.Schema.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.beforeDelete(id);
    const doc = await this.Schema.findById(id);
    if (!doc) {
      throw new ErrorUtil(`No document found with id: ${id}`, 404);
    }

    await this.Schema.findByIdAndDelete(id);
    return { success: true };
  }

  /**
   * @description override with logic from sub-class
   * @param id
   */
  protected async beforeDelete(id: string): Promise<void> {}
}
