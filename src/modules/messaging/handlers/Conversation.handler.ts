import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ConversationModel, IConversation } from '../models/Conversation';
import { MessageModel, IMessage } from '../models/Message';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { Types } from 'mongoose';
import TeamModel from '../../profiles/team/model/TeamModel';

export class ConversationHandler {
  async startConversation(teamId: string, athleteId: string, userId: string, initialMessage: string): Promise<IConversation> {
    const team = await TeamModel.findById(teamId);
    if (!team) {
      throw new ErrorUtil('Team profile not found', 404);
    }

    const athlete = await AthleteModel.findById(athleteId);
    if (!athlete) {
      throw new ErrorUtil('Athlete profile not found', 404);
    }

    let conversation = await ConversationModel.findOne({
      'participants.team': teamId,
      'participants.athlete': athleteId,
    });

    if (conversation) {
      throw new ErrorUtil('Conversation already exists', 400);
    }

    conversation = new ConversationModel({
      participants: {
        team: teamId,
        athlete: athleteId,
      },
      messages: [],
    });

    const message = new MessageModel({
      conversation: conversation._id,
      sender: {
        user: userId,
        profile: teamId,
        role: 'team',
      },
      content: initialMessage,
    });

    await message.save();

    conversation.messages.push(message._id as Types.ObjectId);
    await conversation.save();

    return conversation;
  }

  async sendMessage(conversationId: string, senderId: string, senderProfileId: string, senderRole: 'team' | 'athlete', content: string): Promise<IMessage> {
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      throw new ErrorUtil('Conversation not found', 404);
    }

    const message = new MessageModel({
      conversation: conversationId,
      sender: {
        user: senderId,
        profile: senderProfileId,
        role: senderRole,
      },
      content: content,
    });

    await message.save();
    conversation.messages.push(message._id as Types.ObjectId);
    await conversation.save();

    return message;
  }

  async getConversationsForUser(userId: string, profileId: string, role: 'team' | 'athlete'): Promise<IConversation[]> {
    if (role === 'team') {
      return ConversationModel.find({ 'participants.team': profileId }).populate('participants.athlete', 'fullName profileImageUrl');
    } else {
      return ConversationModel.find({ 'participants.athlete': profileId }).populate('participants.team', 'displayName');
    }
  }

  async getConversation(conversationId: string): Promise<IConversation> {
    const conversation = await ConversationModel.findById(conversationId)
      .populate('participants.athlete', 'fullName profileImageUrl')
      .populate('participants.team', 'displayName')
      .populate('messages');
    if (!conversation) {
      throw new ErrorUtil('Conversation not found', 404);
    }
    return conversation;
  }
}
