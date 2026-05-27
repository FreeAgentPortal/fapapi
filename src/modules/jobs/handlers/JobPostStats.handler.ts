import mongoose from 'mongoose';
import { JobPostModel } from '../models/JobPost';

export interface IJobPostTeamStats {
  totalPosts: number;
  totalPublished: number;
  totalDraft: number;
  totalClosed: number;
  totalApplications: number;
}

const EMPTY_STATS: IJobPostTeamStats = {
  totalPosts: 0,
  totalPublished: 0,
  totalDraft: 0,
  totalClosed: 0,
  totalApplications: 0,
};

export default class JobPostStatsHandler {
  async getTeamStats(teamId: string): Promise<IJobPostTeamStats> {
    const [result] = await JobPostModel.aggregate([
      { $match: { team: new mongoose.Types.ObjectId(teamId) } },
      {
        $facet: {
          totalPosts: [{ $count: 'count' }],
          totalPublished: [{ $match: { status: 'published' } }, { $count: 'count' }],
          totalDraft: [{ $match: { status: 'draft' } }, { $count: 'count' }],
          totalClosed: [{ $match: { status: 'closed' } }, { $count: 'count' }],
          totalApplications: [
            {
              $lookup: {
                from: 'jobapplications',
                localField: '_id',
                foreignField: 'job',
                as: '_apps',
              },
            },
            { $project: { appCount: { $size: '$_apps' } } },
            { $group: { _id: null, total: { $sum: '$appCount' } } },
          ],
        },
      },
      {
        $project: {
          totalPosts: { $ifNull: [{ $arrayElemAt: ['$totalPosts.count', 0] }, 0] },
          totalPublished: { $ifNull: [{ $arrayElemAt: ['$totalPublished.count', 0] }, 0] },
          totalDraft: { $ifNull: [{ $arrayElemAt: ['$totalDraft.count', 0] }, 0] },
          totalClosed: { $ifNull: [{ $arrayElemAt: ['$totalClosed.count', 0] }, 0] },
          totalApplications: { $ifNull: [{ $arrayElemAt: ['$totalApplications.total', 0] }, 0] },
        },
      },
    ]);

    return result ?? EMPTY_STATS;
  }
}
