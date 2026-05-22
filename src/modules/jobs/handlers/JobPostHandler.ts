import mongoose from 'mongoose';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import JobPostModel, { IJobPost } from '../models/JobPost';

export default class JobPostHandler extends CRUDHandler<IJobPost> {
  constructor() {
    super(JobPostModel);
  }

  async fetchRecommended(
    orConditions: Record<string, unknown>[],
    excludeIds: mongoose.Types.ObjectId[],
    page: number,
    limit: number
  ): Promise<{ payload: IJobPost[]; metadata: { totalCount: number; page: number; limit: number } }> {
    const now = new Date();

    const andFilters: object[] = [{ status: 'published' }, { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] }];

    if (excludeIds.length > 0) {
      andFilters.push({ _id: { $nin: excludeIds } });
    }

    andFilters.push({ $or: orConditions });

    const [result] = await this.Schema.aggregate([
      { $match: { $and: andFilters } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page, limit } }],
          entries: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: 'teamprofiles',
                localField: 'team',
                foreignField: '_id',
                as: 'team',
                pipeline: [{ $project: { _id: 1, name: 1, logoUrl: 1 } }],
              },
            },
            {
              $unwind: {
                path: '$team',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);

    return {
      payload: result?.entries ?? [],
      metadata: result?.metadata?.[0] ?? { totalCount: 0, page, limit },
    };
  }

  async updateOwned(id: string, teamId: string, data: Partial<IJobPost>): Promise<IJobPost | null> {
    await this.beforeUpdate(id, data);
    const updated = await this.Schema.findOneAndUpdate({ _id: id, team: teamId }, data, {
      new: true,
      runValidators: true,
    });
    await this.afterUpdate(updated);
    return updated;
  }

  async deleteOwned(id: string, teamId: string): Promise<IJobPost | null> {
    await this.beforeDelete(id);
    const deleted = await this.Schema.findOneAndDelete({ _id: id, team: teamId });
    await this.afterDelete(deleted);
    return deleted;
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: IJobPost[]; metadata: any[] }[]> {
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
                from: 'teamprofiles',
                localField: 'team',
                foreignField: '_id',
                as: 'team',
                pipeline: [{ $project: { _id: 1, name: 1, logoUrl: 1 } }],
              },
            },
            {
              $unwind: {
                path: '$team',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);
  }
}
