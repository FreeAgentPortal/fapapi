import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { ISigning, SigningModel } from '../model/Signing.model';

export class SigningHandler extends CRUDHandler<ISigning> {
  constructor() {
    super(SigningModel);
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: ISigning[]; metadata: any[] }[]> {
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
                from: 'athleteprofiles',
                localField: 'athlete',
                foreignField: '_id',
                as: 'athlete',
              },
            },
            {
              $unwind: {
                path: '$athlete',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: 'teamprofiles',
                localField: 'team',
                foreignField: '_id',
                as: 'team',
              },
            },
            {
              $unwind: {
                path: '$team',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: 'admins',
                localField: 'admin',
                foreignField: '_id',
                as: 'admin',
                pipeline: [
                  // perform an additional lookup to get admin user auth info
                  {
                    $lookup: {
                      from: 'users',
                      localField: 'user',
                      foreignField: '_id',
                      as: 'user',
                      pipeline: [{ $project: { fullName: 1, email: 1, _id: 1 } }],
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
            {
              $unwind: {
                path: '$admin',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);
  }
}
