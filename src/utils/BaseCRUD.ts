import mongoose, { Model } from 'mongoose';
import { ErrorUtil } from '../middleware/ErrorUtil';
import asyncHandler from '../middleware/asyncHandler';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';
import { Request, Response } from 'express';
import error from '../middleware/error';
import { AdvFilters } from './advFilter/AdvFilters';

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

export class CRUDService<T extends mongoose.Document> {
  private handler: CRUDHandler<T>;

  constructor(schema: Model<T>) {
    this.handler = new CRUDHandler<T>(schema);
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      await this.handler.create({ ...req.body, user: req.user._id });
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
  public getResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.fetch(req.params.id);
      if (!result) {
        return res.status(404).json({ message: 'Resource Not found' });
      }
      return res.status(200).json({
        success: true,
        payload: {
          result,
        },
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public getResources = async (req: Request, res: Response): Promise<Response> => {
    try {
      const pageSize = Number(req.query?.limit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      // Generate the keyword query
      const keywordQuery = AdvFilters.query(['subject', 'description'], req.query?.keyword as string);

      // Generate the filter options for inclusion if provided
      const filterIncludeOptions = AdvFilters.filter(req.query?.includeOptions as string);

      // Construct the `$or` array conditionally
      const orConditions = [
        ...(Object.keys(keywordQuery[0]).length > 0 ? keywordQuery : []),
        ...(Array.isArray(filterIncludeOptions) && filterIncludeOptions.length > 0 && Object.keys(filterIncludeOptions[0]).length > 0 ? filterIncludeOptions : []), // Only include if there are filters
      ];
      const [result] = await this.handler.fetchAll({
        filters: AdvFilters.filter(req.query?.filterOptions as string),
        sort: AdvFilters.sort((req.query?.sortOptions as string) || '-createdAt'),
        query: orConditions,
        page,
        limit: pageSize,
      });
      return res.status(200).json({
        success: true,
        payload: [...result.entries],
        metadata: {
          page,
          pages: Math.ceil(result.metadata[0]?.totalCount / pageSize) || 0,
          totalCount: result.metadata[0]?.totalCount || 0,
          prevPage: page - 1,
          nextPage: page + 1,
        },
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      await this.handler.update(req.params.id, req.body);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public removeResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      await this.handler.delete(req.params.id);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
}
