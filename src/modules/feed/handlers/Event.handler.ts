import { CRUDHandler } from '../../../utils/baseCRUD';
import { EventDocument, EventModel } from '../model/Event.model';
import { Types } from 'mongoose';
import { EventRegistrationHandler } from './EventRegistration.handler';
import { RegistrationStatus } from '../model/EventRegistration.model';

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
        $lookup: {
          from: 'eventregistrations',
          localField: '_id',
          foreignField: 'eventId',
          as: 'registrations',
        },
      },
      {
        $addFields: {
          registrationCount: { $size: '$registrations' },
          confirmedRegistrations: {
            $size: {
              $filter: {
                input: '$registrations',
                cond: { $eq: ['$$this.status', 'confirmed'] },
              },
            },
          },
          interestedRegistrations: {
            $size: {
              $filter: {
                input: '$registrations',
                cond: { $eq: ['$$this.status', 'interested'] },
              },
            },
          },
          appliedRegistrations: {
            $size: {
              $filter: {
                input: '$registrations',
                cond: { $eq: ['$$this.status', 'applied'] },
              },
            },
          },
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
          totalRegistrations: { $sum: '$registrationCount' },
          totalConfirmedRegistrations: { $sum: '$confirmedRegistrations' },
          totalInterestedRegistrations: { $sum: '$interestedRegistrations' },
          totalAppliedRegistrations: { $sum: '$appliedRegistrations' },
          totalCapacity: { $sum: { $ifNull: ['$registration.capacity', 0] } },
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
          totalConfirmedRegistrations: { $sum: '$totalConfirmedRegistrations' },
          totalInterestedRegistrations: { $sum: '$totalInterestedRegistrations' },
          totalAppliedRegistrations: { $sum: '$totalAppliedRegistrations' },
          totalCapacity: { $sum: '$totalCapacity' },
          eventTypeBreakdown: {
            $push: {
              type: '$_id',
              count: '$typeCount',
              active: '$activeEvents',
              completed: '$completedEvents',
              upcoming: '$upcomingEvents',
              canceled: '$canceledEvents',
              postponed: '$postponedEvents',
              registrations: '$totalRegistrations',
              confirmedRegistrations: '$totalConfirmedRegistrations',
              interestedRegistrations: '$totalInterestedRegistrations',
              appliedRegistrations: '$totalAppliedRegistrations',
              capacity: '$totalCapacity',
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
          totalConfirmedRegistrations: 0,
          totalInterestedRegistrations: 0,
          totalAppliedRegistrations: 0,
          totalCapacity: 0,
          eventTypeBreakdown: [],
          mostPopularEventType: null,
        };
  }

  async fetch(id: string): Promise<any | null> {
    const eventRegistrationHandler = new EventRegistrationHandler();

    // Fetch event and all registration counts in parallel
    const [event, interestedCount, appliedCount, invitedCount, confirmedCount, waitlistedCount, declinedCount, noShowCount, attendedCount] = await Promise.all([
      this.Schema.findById(id).lean(),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.INTERESTED),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.APPLIED),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.INVITED),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.CONFIRMED),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.WAITLISTED),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.DECLINED),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.NO_SHOW),
      eventRegistrationHandler.getRegistrationCount(id, RegistrationStatus.ATTENDED),
    ]);

    if (!event) {
      return null;
    }

    // Calculate total registrations
    const totalRegistrations = interestedCount + appliedCount + invitedCount + confirmedCount + waitlistedCount + declinedCount + noShowCount + attendedCount;

    return {
      ...event,
      registrations: {
        total: totalRegistrations,
        interested: interestedCount,
        applied: appliedCount,
        invited: invitedCount,
        confirmed: confirmedCount,
        waitlisted: waitlistedCount,
        declined: declinedCount,
        noShow: noShowCount,
        attended: attendedCount,
      },
    };
  }
}
