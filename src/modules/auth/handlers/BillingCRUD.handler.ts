import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import BillingAccount, { BillingAccountType } from '../model/BillingAccount';

export default class BillingCRUDHandler extends CRUDHandler<BillingAccountType> {
  constructor() {
    super(BillingAccount);
  }

  public async fetchAll(options: PaginationOptions): Promise<{ entries: BillingAccountType[]; metadata: any[] }[]> {
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
                from: 'plans',
                localField: 'plan',
                foreignField: '_id',
                as: 'plan',
              },
            },
            { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
          ],
        },
      },
    ]);
  }
}
