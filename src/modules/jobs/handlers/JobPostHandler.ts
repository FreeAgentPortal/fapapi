import mongoose from 'mongoose';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import JobPostModel, { IJobPost } from '../models/JobPost';

export default class JobPostHandler extends CRUDHandler<IJobPost> {
  constructor() {
    super(JobPostModel);
  }

  async fetchRecommended(
    orConditions: Record<string, unknown>[],
    appliedIds: mongoose.Types.ObjectId[],
    page: number,
    limit: number
  ): Promise<{ payload: IJobPost[]; metadata: { totalCount: number; page: number; limit: number } }> {
    const now = new Date();

    const andFilters: object[] = [{ status: 'published' }, { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: orConditions }];

    const [result] = await this.Schema.aggregate([
      { $match: { $and: andFilters } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page, limit } }],
          entries: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { viewers: 0 } },
            { $addFields: { applied: { $in: ['$_id', appliedIds] } } },
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

  async fetchAllAnnotated(options: PaginationOptions, appliedIds: mongoose.Types.ObjectId[]): Promise<{ entries: IJobPost[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query.length > 0 && { $or: options.query }),
        },
      },
      { $sort: options.sort },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            { $project: { viewers: 0 } },
            { $addFields: { applied: { $in: ['$_id', appliedIds] } } },
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
            {
              $lookup: {
                from: 'jobapplications',
                localField: '_id',
                foreignField: 'job',
                as: '_applications',
              },
            },
            {
              $addFields: {
                applicationCount: { $size: '$_applications' },
                activeApplicationCount: {
                  $size: {
                    $filter: {
                      input: '$_applications',
                      as: 'app',
                      cond: { $ne: ['$$app.status', 'rejected'] },
                    },
                  },
                },
              },
            },
            { $project: { _applications: 0 } },
          ],
        },
      },
    ]);
  }

  async recordView(jobId: string, userId: mongoose.Types.ObjectId, ip: string): Promise<void> {
    await this.Schema.updateOne(
      { _id: jobId, 'viewers.userId': { $ne: userId } },
      {
        $inc: { viewCount: 1 },
        $push: { viewers: { userId, ip, viewedAt: new Date() } },
      }
    );
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

  async fetch(id: string): Promise<any | null> {
    const [result] = await this.Schema.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      { $project: { viewers: 0 } },
      {
        $lookup: {
          from: 'teamprofiles',
          localField: 'team',
          foreignField: '_id',
          as: 'team',
          pipeline: [{ $project: { _id: 1, name: 1, logoUrl: 1 } }],
        },
      },
      { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'jobapplications',
          localField: '_id',
          foreignField: 'job',
          as: '_applications',
        },
      },
      {
        $addFields: {
          applicationCount: { $size: '$_applications' },
          activeApplicationCount: {
            $size: {
              $filter: {
                input: '$_applications',
                as: 'app',
                cond: { $ne: ['$$app.status', 'rejected'] },
              },
            },
          },
        },
      },
      { $project: { _applications: 0 } },
    ]);

    return result ?? null;
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
            { $project: { viewers: 0 } },
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
            {
              $lookup: {
                from: 'jobapplications',
                localField: '_id',
                foreignField: 'job',
                as: '_applications',
              },
            },
            {
              $addFields: {
                applicationCount: { $size: '$_applications' },
                activeApplicationCount: {
                  $size: {
                    $filter: {
                      input: '$_applications',
                      as: 'app',
                      cond: { $ne: ['$$app.status', 'rejected'] },
                    },
                  },
                },
              },
            },
            { $project: { _applications: 0 } },
          ],
        },
      },
    ]);
  }
}
