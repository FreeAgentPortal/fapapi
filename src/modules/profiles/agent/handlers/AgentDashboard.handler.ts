import mongoose from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { ConversationModel } from '../../../messaging/models/Conversation';
import { MessageModel } from '../../../messaging/models/Message';
import { AthleteViewModel } from '../../athlete/models/AthleteViewModel';
import { AthleteModel } from '../../athlete/models/AthleteModel';
import { AgentAthleteAssignmentModel } from '../model/AgentAthleteAssignment';
import { AgentSeatManager } from '../utils/AgentSeatManager';

type CardPayload<TSummary, THighlights = undefined> = {
  generatedAt: string;
  days?: number;
  summary: TSummary;
  highlights?: THighlights;
};

type PendingInviteHighlight = {
  assignmentId: string;
  athleteId: string;
  fullName: string;
  email?: string;
  profileImageUrl?: string;
  invitedAt: Date;
};

type TopViewedAthleteHighlight = {
  athleteId: string;
  fullName: string;
  profileImageUrl?: string;
  totalViews: number;
  uniqueViewers: number;
};

type AthleteNeedingReplyHighlight = {
  athleteId: string;
  fullName: string;
  profileImageUrl?: string;
  conversationId: string;
  unreadTeamMessages: number;
  lastMessageAt: Date;
};

export class AgentDashboardHandler {
  async getSeatsCard(agentProfileId: string): Promise<CardPayload<{ seatLimit: number; seatsUsed: number; seatsAvailable: number }>> {
    const summary = await AgentSeatManager.getSeatSummary(agentProfileId);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        seatLimit: summary.seatLimit,
        seatsUsed: summary.seatsUsed,
        seatsAvailable: summary.seatsAvailable,
      },
    };
  }

  async getInvitesCard(
    agentProfileId: string
  ): Promise<
    CardPayload<
      {
        pendingInviteCount: number;
      },
      {
        recentPendingInvites: PendingInviteHighlight[];
      }
    >
  > {
    const [pendingInviteCount, recentPendingInvites] = await Promise.all([
      AgentAthleteAssignmentModel.countDocuments({
        agentProfile: agentProfileId,
        status: 'pending',
      }),
      AgentAthleteAssignmentModel.find({
        agentProfile: agentProfileId,
        status: 'pending',
      })
        .sort({ invitedAt: -1, createdAt: -1 })
        .limit(5)
        .populate('athleteProfile', '_id fullName email profileImageUrl')
        .lean(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        pendingInviteCount,
      },
      highlights: {
        recentPendingInvites: recentPendingInvites.map((invite: any) => ({
          assignmentId: invite._id.toString(),
          athleteId: invite.athleteProfile?._id?.toString() || '',
          fullName: invite.athleteProfile?.fullName || 'Unknown athlete',
          email: invite.athleteProfile?.email,
          profileImageUrl: invite.athleteProfile?.profileImageUrl,
          invitedAt: invite.invitedAt,
        })),
      },
    };
  }

  async getViewsCard(
    agentProfileId: string,
    days: number
  ): Promise<
    CardPayload<
      {
        totalViews: number;
        uniqueViewers: number;
      },
      {
        topViewedAthletes: TopViewedAthleteHighlight[];
      }
    >
  > {
    const athleteIds = await this.getAcceptedAthleteIds(agentProfileId);
    if (athleteIds.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        days,
        summary: {
          totalViews: 0,
          uniqueViewers: 0,
        },
        highlights: {
          topViewedAthletes: [],
        },
      };
    }

    const startDate = this.getStartDate(days);
    const [totalViews, uniqueViewerIds, topViewedRaw] = await Promise.all([
      AthleteViewModel.countDocuments({
        athleteId: { $in: athleteIds },
        createdAt: { $gte: startDate },
      }),
      AthleteViewModel.distinct('viewerId', {
        athleteId: { $in: athleteIds },
        createdAt: { $gte: startDate },
      }),
      AthleteViewModel.aggregate([
        {
          $match: {
            athleteId: { $in: athleteIds },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$athleteId',
            totalViews: { $sum: 1 },
            uniqueViewers: { $addToSet: '$viewerId' },
          },
        },
        {
          $project: {
            totalViews: 1,
            uniqueViewers: { $size: '$uniqueViewers' },
          },
        },
        { $sort: { totalViews: -1, uniqueViewers: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const athleteDocs = await AthleteModel.find({
      _id: { $in: topViewedRaw.map((entry: any) => entry._id) },
    })
      .select('_id fullName profileImageUrl')
      .lean();

    const athleteMap = new Map(athleteDocs.map((athlete: any) => [athlete._id.toString(), athlete]));

    return {
      generatedAt: new Date().toISOString(),
      days,
      summary: {
        totalViews,
        uniqueViewers: uniqueViewerIds.length,
      },
      highlights: {
        topViewedAthletes: topViewedRaw.map((entry: any) => {
          const athlete = athleteMap.get(entry._id.toString());
          return {
            athleteId: entry._id.toString(),
            fullName: athlete?.fullName || 'Unknown athlete',
            profileImageUrl: athlete?.profileImageUrl,
            totalViews: entry.totalViews,
            uniqueViewers: entry.uniqueViewers,
          };
        }),
      },
    };
  }

  async getInboxCard(
    agentProfileId: string,
    days: number
  ): Promise<
    CardPayload<
      {
        activeConversations: number;
        unreadTeamMessages: number;
      },
      {
        athletesNeedingReply: AthleteNeedingReplyHighlight[];
      }
    >
  > {
    const athleteIds = await this.getAcceptedAthleteIds(agentProfileId);
    if (athleteIds.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        days,
        summary: {
          activeConversations: 0,
          unreadTeamMessages: 0,
        },
        highlights: {
          athletesNeedingReply: [],
        },
      };
    }

    const startDate = this.getStartDate(days);
    const agentObjectId = this.toObjectId(agentProfileId);
    const activeConversationQuery = {
      'participants.agent': agentObjectId,
      'participants.athlete': { $in: athleteIds },
      status: { $nin: ['deleted', 'hidden'] },
      updatedAt: { $gte: startDate },
    };

    const [activeConversations, conversations] = await Promise.all([
      ConversationModel.countDocuments(activeConversationQuery),
      ConversationModel.find(activeConversationQuery).select('_id participants.athlete').lean(),
    ]);

    const activeConversationIds = conversations.map((conversation: any) => conversation._id);
    const conversationAthleteMap = new Map(conversations.map((conversation: any) => [conversation._id.toString(), conversation.participants.athlete.toString()]));

    let unreadTeamMessages = 0;
    let replyGroups: any[] = [];

    if (activeConversationIds.length > 0) {
      [unreadTeamMessages, replyGroups] = await Promise.all([
        MessageModel.countDocuments({
          conversation: { $in: activeConversationIds },
          'sender.role': 'team',
          'receiver.role': 'agent',
          'receiver.profile': agentObjectId,
          read: false,
          status: 'active',
          createdAt: { $gte: startDate },
        }),
        MessageModel.aggregate([
          {
            $match: {
              conversation: { $in: activeConversationIds },
              'receiver.role': 'agent',
              'receiver.profile': agentObjectId,
              'sender.role': 'team',
              read: false,
              status: 'active',
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: '$conversation',
              unreadTeamMessages: { $sum: 1 },
              lastMessageAt: { $max: '$createdAt' },
            },
          },
          { $sort: { unreadTeamMessages: -1, lastMessageAt: -1 } },
          { $limit: 5 },
        ]),
      ]);
    }

    const athleteMap = await this.getAthleteIdentityMap(
      replyGroups
        .map((entry: any) => conversationAthleteMap.get(entry._id.toString()))
        .filter(Boolean)
    );

    return {
      generatedAt: new Date().toISOString(),
      days,
      summary: {
        activeConversations,
        unreadTeamMessages,
      },
      highlights: {
        athletesNeedingReply: replyGroups.map((entry: any) => {
          const athleteId = conversationAthleteMap.get(entry._id.toString()) || '';
          const athlete = athleteMap.get(athleteId);
          return {
            athleteId,
            fullName: athlete?.fullName || 'Unknown athlete',
            profileImageUrl: athlete?.profileImageUrl,
            conversationId: entry._id.toString(),
            unreadTeamMessages: entry.unreadTeamMessages,
            lastMessageAt: entry.lastMessageAt,
          };
        }),
      },
    };
  }

  private async getAcceptedAthleteIds(agentProfileId: string) {
    const assignments = await AgentAthleteAssignmentModel.find({
      agentProfile: agentProfileId,
      status: 'accepted',
    })
      .select('athleteProfile')
      .lean();

    return assignments.map((assignment: any) => assignment.athleteProfile);
  }

  private getStartDate(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return startDate;
  }

  private async getAthleteIdentityMap(athleteIds: string[]) {
    if (athleteIds.length === 0) {
      return new Map<string, any>();
    }

    const athletes = await AthleteModel.find({
      _id: { $in: athleteIds },
    })
      .select('_id fullName profileImageUrl')
      .lean();

    return new Map(athletes.map((athlete: any) => [athlete._id.toString(), athlete]));
  }

  private toObjectId(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ErrorUtil('Invalid agent profile reference.', 400);
    }
    return new mongoose.Types.ObjectId(id);
  }
}
