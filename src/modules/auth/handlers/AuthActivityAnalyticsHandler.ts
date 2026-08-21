import mongoose from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import AuthActivityLog from '../model/AuthActivityLog';
import User from '../model/User';

export class AuthActivityAnalyticsHandler {
  public async getSummary(days: number): Promise<any> {
    const endDate = new Date();
    const startDate = this.getStartDate(days, endDate);

    const [overall, dailyActiveUsers, activeUsersByRole] = await Promise.all([
      AuthActivityLog.aggregate([
        {
          $match: {
            lastSeenAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            activeUserIds: { $addToSet: '$userId' },
            activeSessionKeys: {
              $addToSet: {
                $concat: [{ $toString: '$userId' }, ':', '$sessionHash'],
              },
            },
            totalActivityBuckets: { $sum: 1 },
            approximateRequestCount: { $sum: '$requestCount' },
          },
        },
        {
          $project: {
            _id: 0,
            activeUsers: { $size: '$activeUserIds' },
            activeSessions: { $size: '$activeSessionKeys' },
            totalActivityBuckets: 1,
            approximateRequestCount: 1,
          },
        },
      ]),
      AuthActivityLog.aggregate([
        {
          $match: {
            lastSeenAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$bucketStart',
              },
            },
            activeUserIds: { $addToSet: '$userId' },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            activeUsers: { $size: '$activeUserIds' },
          },
        },
        {
          $sort: {
            date: 1,
          },
        },
      ]),
      AuthActivityLog.aggregate([
        {
          $match: {
            lastSeenAt: { $gte: startDate },
          },
        },
        {
          $unwind: {
            path: '$roles',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $group: {
            _id: '$roles',
            activeUserIds: { $addToSet: '$userId' },
          },
        },
        {
          $project: {
            _id: 0,
            role: '$_id',
            activeUsers: { $size: '$activeUserIds' },
          },
        },
        {
          $sort: {
            activeUsers: -1,
            role: 1,
          },
        },
      ]),
    ]);

    return {
      range: {
        days,
        startDate,
        endDate,
      },
      activeUsers: overall[0]?.activeUsers || 0,
      activeSessions: overall[0]?.activeSessions || 0,
      totalActivityBuckets: overall[0]?.totalActivityBuckets || 0,
      approximateRequestCount: overall[0]?.approximateRequestCount || 0,
      dailyActiveUsers,
      activeUsersByRole,
    };
  }

  public async getRecent(days: number, limit: number, page = 1): Promise<any[]> {
    const startDate = this.getStartDate(days);

    return await AuthActivityLog.aggregate([
      {
        $match: {
          lastSeenAt: { $gte: startDate },
        },
      },
      {
        $sort: {
          lastSeenAt: -1,
        },
      },
      {
        $group: {
          _id: '$userId',
          lastSeenAt: { $first: '$lastSeenAt' },
          lastPath: { $first: '$lastPath' },
          lastMethod: { $first: '$lastMethod' },
          lastServiceName: { $first: '$lastServiceName' },
          roles: { $first: '$roles' },
          profileRefs: { $first: '$profileRefs' },
          requestCount: { $sum: '$requestCount' },
          activityBuckets: { $sum: 1 },
          sessionHashes: { $addToSet: '$sessionHash' },
        },
      },
      {
        $sort: {
          lastSeenAt: -1,
        },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                _id: 1,
                fullName: 1,
                email: 1,
                profileImageUrl: 1,
                role: 1,
                isActive: 1,
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
      {
        $project: {
          _id: 0,
          userId: '$_id',
          user: 1,
          roles: 1,
          profileRefs: 1,
          lastSeenAt: 1,
          lastPath: 1,
          lastMethod: 1,
          lastServiceName: 1,
          approximateRequestCount: '$requestCount',
          activityBuckets: 1,
          activeSessions: { $size: '$sessionHashes' },
        },
      },
    ]);
  }

  public async getRecentCount(days: number): Promise<number> {
    const startDate = this.getStartDate(days);
    const result = await AuthActivityLog.aggregate([
      {
        $match: {
          lastSeenAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$userId',
        },
      },
      {
        $count: 'totalCount',
      },
    ]);

    return result[0]?.totalCount || 0;
  }

  public async getUserActivity(userId: string, days: number, page: number, limit: number): Promise<any> {
    if (!mongoose.isValidObjectId(userId)) {
      throw new ErrorUtil('Invalid user id', 400);
    }

    const user = await User.findById(userId)
      .select('_id firstName lastName fullName email profileImageUrl role isActive lastSignedIn')
      .lean();

    if (!user) {
      throw new ErrorUtil('User not found', 404);
    }

    const startDate = this.getStartDate(days);
    const objectId = new mongoose.Types.ObjectId(userId);
    const [activityResult] = await AuthActivityLog.aggregate([
      {
        $match: {
          userId: objectId,
          lastSeenAt: { $gte: startDate },
        },
      },
      {
        $sort: {
          lastSeenAt: -1,
          _id: -1,
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                firstSeenAt: { $min: '$firstSeenAt' },
                lastSeenAt: { $max: '$lastSeenAt' },
                activityBuckets: { $sum: 1 },
                approximateRequestCount: { $sum: '$requestCount' },
                sessionHashes: { $addToSet: '$sessionHash' },
              },
            },
            {
              $project: {
                _id: 0,
                firstSeenAt: 1,
                lastSeenAt: 1,
                activityBuckets: 1,
                approximateRequestCount: 1,
                activeSessions: { $size: '$sessionHashes' },
              },
            },
          ],
          entries: [
            {
              $skip: (page - 1) * limit,
            },
            {
              $limit: limit,
            },
            {
              $project: {
                _id: 1,
                bucketStart: 1,
                firstSeenAt: 1,
                lastSeenAt: 1,
                approximateRequestCount: '$requestCount',
                lastPath: 1,
                lastMethod: 1,
                lastServiceName: 1,
                sessionSource: 1,
                ipAddress: 1,
                userAgent: 1,
                roles: 1,
              },
            },
          ],
          metadata: [
            {
              $count: 'totalCount',
            },
          ],
        },
      },
    ]);

    return {
      user,
      range: {
        days,
        startDate,
        endDate: new Date(),
      },
      summary: activityResult?.summary?.[0] || {
        firstSeenAt: null,
        lastSeenAt: null,
        activityBuckets: 0,
        approximateRequestCount: 0,
        activeSessions: 0,
      },
      entries: activityResult?.entries || [],
      totalCount: activityResult?.metadata?.[0]?.totalCount || 0,
    };
  }

  private getStartDate(days: number, endDate = new Date()): Date {
    return new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  }
}
