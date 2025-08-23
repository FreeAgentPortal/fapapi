import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import SearchReport, { ISearchReport } from '../models/SearchReport';

export class ReportHandler extends CRUDHandler<ISearchReport> {
  constructor() {
    super(SearchReport);
  }

  async fetch(id: string): Promise<any | null> {
    return await this.Schema.findById(id)
      .populate({
        path: 'searchPreference',
        select: '_id name description ageRange positions performanceMetrics',
      })
      .populate({
        path: 'results',
        select: '_id fullName birthdate positions profileImageUrl diamondRating',
      })
      .lean();
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: ISearchReport[]; metadata: any[] }[]> {
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
                from: 'searchpreferences',
                localField: 'searchPreference',
                foreignField: '_id',
                as: 'searchPreference',
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: '$searchPreference',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);
  }
}
