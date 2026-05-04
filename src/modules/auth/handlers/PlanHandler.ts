import mongoose, { Document } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import User from '../model/User';
import PlanSchema, { PlanType } from '../model/PlanSchema';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';

export class PlanHandler extends CRUDHandler<PlanType> {
  constructor() {
    super(PlanSchema);
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: PlanType[]; metadata: any[] }[]> {
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
          entries: [{ $skip: (options.page - 1) * options.limit }, { $limit: options.limit }, {
            $lookup: {
              from: 'features',
              localField: 'features',
              foreignField: '_id',
              as: 'features',
            }
          }],
        },
      },
    ]);
  }
}
