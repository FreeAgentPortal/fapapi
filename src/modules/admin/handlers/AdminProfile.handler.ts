import mongoose, { Document } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import AdminModel, { AdminType } from '../model/AdminModel';

export class AdminProfileHandler extends CRUDHandler<AdminType> {
  constructor() {
    super(AdminModel);
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: AdminType[]; metadata: any[] }[]> {
    try {
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
            entries: [
              { $skip: (options.page - 1) * options.limit },
              { $limit: options.limit },
              {
                $lookup: {
                  from: 'users',
                  localField: 'user',
                  foreignField: '_id',
                  as: 'user',
                  pipeline: [
                    {
                      $project: {
                        _id: 1,
                        email: 1,
                        fullName: 1,
                      },
                    },
                  ],
                },
              },
              {
                $unwind: {
                  path: '$user',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
          },
        },
      ]);
    } catch (error) {
      throw new ErrorUtil('Failed to fetch admin profiles', 500);
    }
  }
}
