import { CRUDHandler } from '../../../utils/baseCRUD';
import { EventDocument, EventModel } from '../model/Event.model';
import { Types } from 'mongoose';

export class EventHandler extends CRUDHandler<EventDocument> {
  constructor() {
    super(EventModel);
  }

  /**
   * @description: Event statistics aggregation pipeline for a specific team
   * @param teamProfileId - The team's profile ID to get statistics for
   */
  public async getEventStatistics(teamProfileId: string | Types.ObjectId): Promise<any> {
    const pipeline = [
      {
        $match: {
          teamProfileId: new Types.ObjectId(teamProfileId),
        },
      },
      {
        $group: {
          _id: '$type',
          typeCount: { $sum: 1 },
          activeEvents: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          completedEvents: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          upcomingEvents: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
          canceledEvents: { $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] } },
          postponedEvents: { $sum: { $cond: [{ $eq: ['$status', 'postponed'] }, 1, 0] } },
          totalRegistrations: { $sum: { $ifNull: ['$registration.capacity', 0] } },
        },
      },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: '$typeCount' },
          activeEvents: { $sum: '$activeEvents' },
          completedEvents: { $sum: '$completedEvents' },
          upcomingEvents: { $sum: '$upcomingEvents' },
          canceledEvents: { $sum: '$canceledEvents' },
          postponedEvents: { $sum: '$postponedEvents' },
          totalRegistrations: { $sum: '$totalRegistrations' },
          eventTypeBreakdown: {
            $push: {
              type: '$_id',
              count: '$typeCount',
              active: '$activeEvents',
              completed: '$completedEvents',
              upcoming: '$upcomingEvents',
              canceled: '$canceledEvents',
              postponed: '$postponedEvents',
            },
          },
          mostPopularEventType: {
            $first: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: [
                      {
                        type: '$_id',
                        count: '$typeCount',
                      },
                    ],
                    sortBy: { count: -1 },
                  },
                },
                0,
              ],
            },
          },
        },
      },
    ];

    const stats = await this.Schema.aggregate(pipeline);
    return stats.length > 0
      ? stats[0]
      : {
          totalEvents: 0,
          activeEvents: 0,
          completedEvents: 0,
          upcomingEvents: 0,
          canceledEvents: 0,
          postponedEvents: 0,
          totalRegistrations: 0,
          eventTypeBreakdown: [],
          mostPopularEventType: null,
        };
  }
}
