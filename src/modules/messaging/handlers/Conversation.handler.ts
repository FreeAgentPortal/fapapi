import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ConversationModel, IConversation } from '../models/Conversation';
import { MessageModel, IMessage } from '../models/Message';
import { ScoutModel } from '../../profiles/scout/model/ScoutProfile';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { Types } from 'mongoose';

export class ConversationHandler {
  async startConversation(scoutId: string, athleteId: string, userId: string, initialMessage: string): Promise<IConversation> {
    const scout = await ScoutModel.findById(scoutId);
    if (!scout) {
      throw new ErrorUtil('Scout profile not found', 404);
    }

    const athlete = await AthleteModel.findById(athleteId);
    if (!athlete) {
      throw new ErrorUtil('Athlete profile not found', 404);
    }

    let conversation = await ConversationModel.findOne({
      'participants.scout': scoutId,
      'participants.athlete': athleteId,
    });

    if (conversation) {
      throw new ErrorUtil('Conversation already exists', 400);
    }

    conversation = new ConversationModel({
      participants: {
        scout: scoutId,
        athlete: athleteId,
      },
      messages: [],
    });

    const message = new MessageModel({
      conversation: conversation._id,
      sender: {
        user: userId,
        profile: scoutId,
        role: 'scout',
      },
      content: initialMessage,
    });

    await message.save();

    conversation.messages.push(message._id as Types.ObjectId);
    await conversation.save();

    return conversation;
  }

  async sendMessage(conversationId: string, senderId: string, senderProfileId: string, senderRole: 'scout' | 'athlete', content: string): Promise<IMessage> {
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

  async getConversationsForUser(userId: string, profileId: string, role: 'scout' | 'athlete'): Promise<IConversation[]> {
    if (role === 'scout') {
      return ConversationModel.find({ 'participants.scout': profileId })
        .populate({
          path: 'messages',
          options: { sort: { createdAt: -1 } },
        })
        .populate('participants.athlete', 'fullName profileImageUrl');
    } else {
      return ConversationModel.find({ 'participants.athlete': profileId })
        .populate({
          path: 'messages',
          options: { sort: { createdAt: -1 } },
        })
        .populate('participants.scout', 'displayName');
    }
  }
}
