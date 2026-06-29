import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ConversationModel, IConversation } from '../models/Conversation';
import { MessageModel, IMessage } from '../models/Message';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { Types } from 'mongoose';
import TeamModel from '../../profiles/team/model/TeamModel';
import { AgentProfileModel } from '../../profiles/agent/model/AgentProfile';

type ConversationRole = 'team' | 'athlete' | 'agent';

export class ConversationHandler {
  async startConversation(teamId: string, athleteId: string, userId: string, initialMessage: string) {
    const team = await TeamModel.findById(teamId);
    if (!team) {
      throw new ErrorUtil('Team profile not found', 404);
    }

    const athlete = await AthleteModel.findById(athleteId);
    if (!athlete) {
      throw new ErrorUtil('Athlete profile not found', 404);
    }

    const activeAgentProfileId = athlete.agent?.status === 'active' && athlete.agent?.profile ? athlete.agent.profile.toString() : null;

    const existingConversationFilter: Record<string, any> = {
      'participants.team': teamId,
      'participants.athlete': athleteId,
    };
    if (activeAgentProfileId) {
      existingConversationFilter['participants.agent'] = activeAgentProfileId;
    } else {
      existingConversationFilter['participants.agent'] = { $exists: false };
    }

    let conversation = await ConversationModel.findOne(existingConversationFilter);

    if (conversation) {
      throw new ErrorUtil('Conversation already exists', 400);
    }

    const agent = activeAgentProfileId ? await AgentProfileModel.findById(activeAgentProfileId) : null;

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

    conversation.messages.push(newMessage._id as Types.ObjectId);
    conversation.lastMessage = newMessage._id as any;
    await conversation.save();

    return { conversation, newMessage };
  }

  async sendMessage(conversationId: string, senderId: string, senderProfileId: string, senderRole: ConversationRole, content: string): Promise<IMessage> {
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      throw new ErrorUtil('Conversation not found', 404);
    }

    const athlete = await AthleteModel.findById(conversation.participants.athlete).lean();
    const athleteHasActiveAgent = !!athlete?.agent?.profile && athlete?.agent?.status === 'active';

    this.assertAuthorizedSender(conversation, senderProfileId, senderRole);

    if (senderRole === 'team' && athleteHasActiveAgent && !conversation.participants.agent) {
      throw new ErrorUtil('This athlete is represented by an agent. Start or continue the conversation with the agent instead.', 400);
    }

    if (senderRole === 'athlete' && (conversation.participants.agent || athleteHasActiveAgent)) {
      throw new ErrorUtil('Teams must communicate with the athlete agent while representation is active.', 400);
    }

    const receiver = this.resolveReceiver(conversation, senderRole);

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
    conversation.messages.push(message._id as Types.ObjectId);
    conversation.lastMessage = message._id as any;
    await conversation.save();

    return message;
  }

  async getConversationsForUser(userId: string, profileId: string, role: ConversationRole): Promise<IConversation[]> {
    if (role === 'team') {
      return ConversationModel.find({
        'participants.team': profileId,
        // Exclude deleted conversations, and hidden conversations
        $and: [{ status: { $ne: 'deleted' } }, { status: { $ne: 'hidden' } }],
      })
        .populate('participants.athlete', 'fullName profileImageUrl')
        .populate('participants.agent', 'displayName agencyName email contactNumber');
    }

    if (role === 'agent') {
      return ConversationModel.find({
        'participants.agent': profileId,
        $and: [{ status: { $ne: 'deleted' } }, { status: { $ne: 'hidden' } }],
      })
        .populate('participants.team', 'name logos')
        .populate('participants.athlete', 'fullName profileImageUrl');
    }

    return ConversationModel.find({
      'participants.athlete': profileId,
      'participants.agent': { $exists: false },
      $and: [{ status: { $ne: 'deleted' } }, { status: { $ne: 'hidden' } }],
    }).populate('participants.team', 'name logos');
  }

  async getConversation(conversationId: string): Promise<IConversation> {
    const conversation = await ConversationModel.findById(conversationId)
      .populate('participants.athlete', 'fullName profileImageUrl')
      .populate('participants.team', 'name logos')
      .populate('participants.agent', 'displayName agencyName email contactNumber')
      .populate('messages');
    if (!conversation) {
      throw new ErrorUtil('Conversation not found', 404);
    }
    return conversation;
  }

  private resolveReceiver(conversation: IConversation, senderRole: ConversationRole): { profile: Types.ObjectId; role: ConversationRole } {
    if (senderRole === 'team') {
      if (conversation.participants.agent) {
        return {
          profile: conversation.participants.agent,
          role: 'agent',
        };
      }
      return {
        profile: conversation.participants.athlete,
        role: 'athlete',
      };
    }

    return {
      profile: conversation.participants.team,
      role: 'team',
    };
  }

  private assertAuthorizedSender(conversation: IConversation, senderProfileId: string, senderRole: ConversationRole): void {
    if (senderRole === 'team' && conversation.participants.team.toString() !== senderProfileId) {
      throw new ErrorUtil('Unauthorized to participate in this conversation.', 403);
    }

    if (senderRole === 'athlete') {
      if (conversation.participants.athlete.toString() !== senderProfileId) {
        throw new ErrorUtil('Unauthorized to participate in this conversation.', 403);
      }
      return;
    }

    if (!conversation.participants.agent || conversation.participants.agent.toString() !== senderProfileId) {
      throw new ErrorUtil('Unauthorized to participate in this conversation.', 403);
    }
  }
}
