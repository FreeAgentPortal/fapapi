import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ConversationModel, IConversation } from '../models/Conversation';
import { MessageModel, IMessage } from '../models/Message';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { Types } from 'mongoose';
import TeamModel from '../../profiles/team/model/TeamModel';
import { AgentProfileModel } from '../../profiles/agent/model/AgentProfile';
import logger from '../../../utils/logger';

type ConversationRole = 'team' | 'athlete' | 'agent';

type ConversationListMessage = Pick<IMessage, 'receiver' | 'read' | 'status'>;

type ConversationListItem = Record<string, any> & {
  lastMessage?: ConversationListMessage | null;
  hasUnreadMessages: boolean;
};

export class ConversationHandler {
  async startConversation(teamId: string, athleteId: string, userId: string, initialMessage: string) {
    logger.debug({ teamId, athleteId, userId }, 'startConversation: initiated');

    const team = await TeamModel.findById(teamId);
    if (!team) {
      logger.debug({ teamId }, 'startConversation: team not found');
      throw new ErrorUtil('Team profile not found', 404);
    }
    logger.debug({ teamId }, 'startConversation: team found');

    const athlete = await AthleteModel.findById(athleteId);
    if (!athlete) {
      logger.debug({ athleteId }, 'startConversation: athlete not found');
      throw new ErrorUtil('Athlete profile not found', 404);
    }
    logger.debug({ athleteId }, 'startConversation: athlete found');

    const activeAgentProfileId = athlete.agent?.status === 'active' && athlete.agent?.profile ? athlete.agent.profile.toString() : null;
    logger.debug({ athleteId, activeAgentProfileId }, 'startConversation: resolved active agent');

    const existingConversationFilter: Record<string, any> = {
      'participants.team': teamId,
      'participants.athlete': athleteId,
    };
    if (activeAgentProfileId) {
      existingConversationFilter['participants.agent'] = activeAgentProfileId;
    } else {
      existingConversationFilter['participants.agent'] = { $exists: false };
    }
    logger.debug({ existingConversationFilter }, 'startConversation: querying for existing conversation');

    let conversation = await ConversationModel.findOne(existingConversationFilter);

    if (conversation) {
      logger.debug({ conversationId: conversation._id }, 'startConversation: conversation already exists');
      throw new ErrorUtil('Conversation already exists', 400);
    }
    logger.debug({ teamId, athleteId }, 'startConversation: no existing conversation found, creating new');

    const agent = activeAgentProfileId ? await AgentProfileModel.findById(activeAgentProfileId) : null;
    logger.debug({ activeAgentProfileId, agentFound: !!agent }, 'startConversation: agent lookup result');

    conversation = new ConversationModel({
      participants: {
        team: teamId,
        athlete: athleteId,
        ...(agent ? { agent: agent._id } : {}),
      },
      messages: [],
    });

    const receiverRole: ConversationRole = agent ? 'agent' : 'athlete';
    const receiverProfile = agent ? agent._id : conversation.participants.athlete;
    logger.debug({ receiverRole, receiverProfile }, 'startConversation: resolved receiver for initial message');

    const newMessage = new MessageModel({
      conversation: conversation._id,
      sender: {
        profile: teamId,
        role: 'team',
      },
      receiver: {
        profile: receiverProfile,
        role: receiverRole,
      },
      content: initialMessage,
    });

    await newMessage.save();
    logger.debug({ messageId: newMessage._id }, 'startConversation: initial message saved');

    conversation.messages.push(newMessage._id as Types.ObjectId);
    conversation.lastMessage = newMessage._id as any;
    await conversation.save();
    logger.debug({ conversationId: conversation._id }, 'startConversation: conversation saved');

    return { conversation, newMessage };
  }

  async sendMessage(conversationId: string, senderId: string, senderProfileId: string, senderRole: ConversationRole, content: string): Promise<IMessage> {
    logger.debug({ conversationId, senderId, senderProfileId, senderRole }, 'sendMessage: initiated');

    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      logger.debug({ conversationId }, 'sendMessage: conversation not found');
      throw new ErrorUtil('Conversation not found', 404);
    }
    logger.debug({ conversationId }, 'sendMessage: conversation found');

    const athlete = await AthleteModel.findById(conversation.participants.athlete).lean();
    const athleteHasActiveAgent = !!athlete?.agent?.profile && athlete?.agent?.status === 'active';
    logger.debug({ athleteId: conversation.participants.athlete, athleteHasActiveAgent }, 'sendMessage: athlete agent status resolved');

    logger.debug({ conversationId, senderProfileId, senderRole }, 'sendMessage: asserting sender authorization');
    this.assertAuthorizedSender(conversation, senderProfileId, senderRole, athleteHasActiveAgent);
    logger.debug({ senderProfileId, senderRole }, 'sendMessage: sender authorized');

    if (senderRole === 'team' && athleteHasActiveAgent && !conversation.participants.agent) {
      logger.debug({ conversationId, senderRole, athleteHasActiveAgent }, 'sendMessage: team blocked — athlete has active agent not on conversation');
      throw new ErrorUtil('This athlete is represented by an agent. Start or continue the conversation with the agent instead.', 400);
    }

    if (senderRole === 'athlete' && (conversation.participants.agent || athleteHasActiveAgent)) {
      logger.debug({ conversationId, senderRole, athleteHasActiveAgent }, 'sendMessage: athlete blocked — active representation in place');
      throw new ErrorUtil('Teams must communicate with the athlete agent while representation is active.', 400);
    }

    const receiver = this.resolveReceiver(conversation, senderRole);
    logger.debug({ receiver }, 'sendMessage: receiver resolved');

    const message = new MessageModel({
      conversation: conversationId,
      sender: {
        profile: senderProfileId,
        role: senderRole,
      },
      receiver,
      content: content,
    });

    await message.save();
    logger.debug({ messageId: message._id, conversationId }, 'sendMessage: message saved');

    conversation.messages.push(message._id as Types.ObjectId);
    conversation.lastMessage = message._id as any;
    await conversation.save();
    logger.debug({ conversationId }, 'sendMessage: conversation updated with new message');

    return message;
  }

  async getConversationsForUser(userId: string, profileId: string, role: ConversationRole): Promise<ConversationListItem[]> {
    logger.debug({ userId, profileId, role }, 'getConversationsForUser: initiated');

    let conversations: Record<string, any>[];

    if (role === 'team') {
      logger.debug({ profileId }, 'getConversationsForUser: querying as team');
      conversations = await ConversationModel.find({
        'participants.team': profileId,
        // Exclude deleted conversations, and hidden conversations
        $and: [{ status: { $ne: 'deleted' } }, { status: { $ne: 'hidden' } }],
      })
        .populate('participants.athlete', 'fullName profileImageUrl')
        .populate('participants.agent', 'displayName agencyName email contactNumber')
        .populate('lastMessage')
        .lean();
    } else if (role === 'agent') {
      logger.debug({ profileId }, 'getConversationsForUser: querying as agent');
      conversations = await ConversationModel.find({
        'participants.agent': profileId,
        $and: [{ status: { $ne: 'deleted' } }, { status: { $ne: 'hidden' } }],
      })
        .populate('participants.team', 'name logos')
        .populate('participants.athlete', 'fullName profileImageUrl')
        .populate('lastMessage')
        .lean();
    } else {
      logger.debug({ profileId }, 'getConversationsForUser: querying as athlete (no agent)');
      conversations = await ConversationModel.find({
        'participants.athlete': profileId,
        'participants.agent': { $exists: false },
        $and: [{ status: { $ne: 'deleted' } }, { status: { $ne: 'hidden' } }],
      })
        .populate('participants.team', 'name logos')
        .populate('lastMessage')
        .lean();
    }

    await this.inflateSenderProfiles(conversations);

    return conversations.map((conversation) => {
      const lastMessage = conversation.lastMessage as ConversationListMessage | null | undefined;
      const hasUnreadMessages = Boolean(
        lastMessage &&
        lastMessage.status === 'active' &&
        !lastMessage.read &&
        lastMessage.receiver.role === role &&
        lastMessage.receiver.profile.toString() === profileId.toString()
      );

      return {
        ...conversation,
        hasUnreadMessages,
      };
    });
  }

  async getUnreadConversationCount(profileId: string, role: ConversationRole): Promise<number> {
    const unreadConversationIds = await MessageModel.distinct('conversation', {
      'receiver.profile': profileId,
      'receiver.role': role,
      read: false,
      status: 'active',
    });

    if (unreadConversationIds.length === 0) {
      return 0;
    }

    const participantQuery =
      role === 'team'
        ? { 'participants.team': profileId }
        : role === 'agent'
          ? { 'participants.agent': profileId }
          : {
              'participants.athlete': profileId,
              'participants.agent': { $exists: false },
            };

    return await ConversationModel.countDocuments({
      _id: { $in: unreadConversationIds },
      ...participantQuery,
      status: { $nin: ['deleted', 'hidden'] },
    });
  }

  async getConversation(conversationId: string): Promise<IConversation> {
    logger.debug({ conversationId }, 'getConversation: initiated');

    const conversation = await ConversationModel.findById(conversationId)
      .populate('participants.athlete', 'fullName profileImageUrl')
      .populate('participants.team', 'name logos')
      .populate('participants.agent', 'displayName agencyName email contactNumber')
      .populate('messages');
    if (!conversation) {
      logger.debug({ conversationId }, 'getConversation: conversation not found');
      throw new ErrorUtil('Conversation not found', 404);
    }
    logger.debug({ conversationId, messageCount: conversation.messages.length }, 'getConversation: conversation retrieved');
    return conversation;
  }

  private resolveReceiver(conversation: IConversation, senderRole: ConversationRole): { profile: Types.ObjectId; role: ConversationRole } {
    logger.debug({ conversationId: conversation._id, senderRole }, 'resolveReceiver: resolving receiver');

    if (senderRole === 'team') {
      if (conversation.participants.agent) {
        logger.debug({ conversationId: conversation._id, agentId: conversation.participants.agent }, 'resolveReceiver: routing to agent');
        return {
          profile: conversation.participants.agent,
          role: 'agent',
        };
      }
      logger.debug({ conversationId: conversation._id, athleteId: conversation.participants.athlete }, 'resolveReceiver: routing to athlete');
      return {
        profile: conversation.participants.athlete,
        role: 'athlete',
      };
    }

    logger.debug({ conversationId: conversation._id, teamId: conversation.participants.team }, 'resolveReceiver: routing to team');
    return {
      profile: conversation.participants.team,
      role: 'team',
    };
  }

  /**
   * Batch-inflates lastMessage.sender for a list of conversations.
   * Attaches { _id, name } to sender.senderProfile for each conversation
   * that has a populated lastMessage with a resolvable sender role.
   */
  private async inflateSenderProfiles(conversations: Record<string, any>[]): Promise<void> {
    // Collect sender IDs grouped by role
    const sendersByRole = new Map<string, Set<string>>();

    for (const conv of conversations) {
      const sender = conv.lastMessage?.sender;
      if (!sender?.profile || !sender?.role) continue;

      if (!sendersByRole.has(sender.role)) {
        sendersByRole.set(sender.role, new Set());
      }
      sendersByRole.get(sender.role)!.add(sender.profile.toString());
    }

    // Batch fetch names per role and build a keyed lookup map
    const profileNameMap = new Map<string, string>();

    for (const [role, ids] of sendersByRole) {
      const idArray = Array.from(ids);

      try {
        if (role === 'athlete') {
          const profiles = await AthleteModel.find({ _id: { $in: idArray } }, { _id: 1, fullName: 1 }).lean();
          for (const p of profiles as any[]) {
            profileNameMap.set(`athlete:${p._id.toString()}`, p.fullName ?? null);
          }
        } else if (role === 'team') {
          const profiles = await TeamModel.find({ _id: { $in: idArray } }, { _id: 1, name: 1 }).lean();
          for (const p of profiles as any[]) {
            profileNameMap.set(`team:${p._id.toString()}`, p.name ?? null);
          }
        } else if (role === 'agent') {
          const profiles = await AgentProfileModel.find({ _id: { $in: idArray } }, { _id: 1, displayName: 1, agencyName: 1 }).lean();
          for (const p of profiles as any[]) {
            profileNameMap.set(`agent:${p._id.toString()}`, p.displayName || p.agencyName || null);
          }
        }
      } catch (error) {
        logger.error({ err: error, role }, '[ConversationHandler] Failed to inflate sender profiles for role.');
      }
    }

    // Attach resolved name to each sender
    for (const conv of conversations) {
      const sender = conv.lastMessage?.sender;
      if (!sender?.profile || !sender?.role) continue;

      const key = `${sender.role}:${sender.profile.toString()}`;
      const name = profileNameMap.get(key);
      if (name !== undefined) {
        sender.senderProfile = { _id: sender.profile, name };
      }
    }
  }

  private assertAuthorizedSender(conversation: IConversation, senderProfileId: string, senderRole: ConversationRole, hasActiveAgent: boolean): void {
    logger.debug({ conversationId: conversation._id, senderProfileId, senderRole }, 'assertAuthorizedSender: checking authorization');

    if (senderRole === 'team' && conversation.participants.team.toString() !== senderProfileId.toString()) {
      logger.debug(
        { conversationId: conversation._id, senderProfileId, expectedTeamId: conversation.participants.team },
        'assertAuthorizedSender: team profile mismatch — unauthorized'
      );
      throw new ErrorUtil('Unauthorized to participate in this conversation.', 403);
    }

    if (senderRole === 'athlete') {
      if (conversation.participants.athlete.toString() !== senderProfileId.toString()) {
        logger.debug(
          { conversationId: conversation._id, senderProfileId, expectedAthleteId: conversation.participants.athlete },
          'assertAuthorizedSender: athlete profile mismatch — unauthorized'
        );
        throw new ErrorUtil('Unauthorized to participate in this conversation.', 403);
      }
      logger.debug({ senderProfileId }, 'assertAuthorizedSender: athlete authorized');
      return;
    }

    if (hasActiveAgent) {
      if (!conversation.participants.agent || conversation.participants.agent.toString() !== senderProfileId.toString()) {
        logger.debug(
          { conversationId: conversation._id, senderProfileId, agentId: conversation.participants.agent },
          'assertAuthorizedSender: agent profile mismatch — unauthorized'
        );
        throw new ErrorUtil('Unauthorized to participate in this conversation.', 403);
      }
      logger.debug({ senderProfileId }, 'assertAuthorizedSender: agent authorized');
    }
  }
}
