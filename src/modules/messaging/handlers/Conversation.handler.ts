import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ConversationModel, IConversation } from '../models/Conversation';
import { MessageModel, IMessage } from '../models/Message';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { Types } from 'mongoose';
import TeamModel from '../../profiles/team/model/TeamModel';

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

    const newMessage = new MessageModel({
      conversation: conversation._id,
      sender: {
        profile: teamId,
        role: 'team',
      },
      receiver: {
        profile: conversation.participants.athlete,
        role: 'athlete',
      },
      content: initialMessage,
    });

    await newMessage.save();

    conversation.messages.push(newMessage._id as Types.ObjectId);
    await conversation.save();

    return { conversation, newMessage };
  }

  async sendMessage(conversationId: string, senderId: string, senderProfileId: string, senderRole: 'team' | 'athlete', content: string): Promise<IMessage> {
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      throw new ErrorUtil('Conversation not found', 404);
    }

    const message = new MessageModel({
      conversation: conversationId,
      sender: {
        profile: senderProfileId,
        role: senderRole,
      },
      receiver: {
        profile: conversation.participants[senderRole === 'team' ? 'athlete' : 'team'],
        role: senderRole === 'team' ? 'athlete' : 'team',
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
      return ConversationModel.find({ 'participants.athlete': profileId }).populate('participants.team', 'name logos');
    }
  }

  async getConversation(conversationId: string): Promise<IConversation> {
    const conversation = await ConversationModel.findById(conversationId)
      .populate('participants.athlete', 'fullName profileImageUrl')
      .populate('participants.team', 'name logos')
      .populate('messages');
    if (!conversation) {
      throw new ErrorUtil('Conversation not found', 404);
    }
    return conversation;
  }
}
