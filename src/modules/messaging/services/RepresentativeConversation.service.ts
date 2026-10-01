import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AgentProfileModel } from '../../profiles/agent/model/AgentProfile';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import TeamModel from '../../profiles/team/model/TeamModel';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { getAthleteRepresentative } from '../utils/athleteRepresentation';

export class RepresentativeConversationService {
  async start(senderId: string, senderRole: 'team' | 'agent', input: { athleteId?: unknown; representativeId?: unknown; message?: unknown }) {
    const { athleteId, representativeId } = input;
    if (typeof athleteId !== 'string' || !Types.ObjectId.isValid(athleteId) ||
        typeof representativeId !== 'string' || !Types.ObjectId.isValid(representativeId) || !Types.ObjectId.isValid(senderId)) {
      throw new ErrorUtil('Valid athlete and representative profiles are required.', 400);
    }
    const athlete = await AthleteModel.findById(athleteId).lean();
    if (!athlete || athlete.isActive === false) throw new ErrorUtil('Athlete profile not found.', 404);
    const representative = getAthleteRepresentative(athlete.agent);
    if (representative?.status !== 'active' || !representative.profile ||
        String(representative.profile) !== representativeId) {
      throw new ErrorUtil('The athlete’s representative has changed or is outside the platform. Refresh the athlete profile to review their contact details.', 409);
    }
    if (senderRole === 'agent' && senderId === representativeId) {
      throw new ErrorUtil('You represent this athlete. Continue your direct athlete conversation.', 400);
    }
    const sender = senderRole === 'team'
      ? await TeamModel.findById(senderId).lean()
      : await AgentProfileModel.findById(senderId).lean();
    if (!sender || (senderRole === 'agent' && sender.isActive === false)) throw new ErrorUtil('Sender profile unavailable.', 403);
    const agent = await AgentProfileModel.findById(representativeId).lean();
    if (!agent || agent.isActive === false) throw new ErrorUtil('Representative profile unavailable.', 404);

    const ids = [senderId, representativeId].map(id => new Types.ObjectId(id).toHexString()).sort();
    const directKey = senderRole === 'team'
      ? ['agent', new Types.ObjectId(representativeId).toHexString(), 'team', new Types.ObjectId(senderId).toHexString()].join(':')
      : ['agent', ids[0], 'agent', ids[1]].join(':');
    const existing = await ConversationModel.findOne({ directKey });
    if (existing) return this.reuse(existing);
    const content = typeof input.message === 'string' ? input.message.trim() : '';
    if (!content || content.length > 2000) throw new ErrorUtil('A message between 1 and 2000 characters is required.', 400);
    try {
      return await ConversationModel.db.transaction(async session => {
        const [conversation] = await ConversationModel.create([{
          directKey,
          participants: senderRole === 'team' ? { team: senderId, agent: representativeId } : { agents: ids },
          messages: [],
        }], { session });
        const [newMessage] = await MessageModel.create([{
          conversation: conversation._id,
          sender: { role: senderRole, profile: senderId },
          receiver: { role: 'agent', profile: representativeId },
          content,
        }], { session });
        conversation.messages.push(newMessage._id as Types.ObjectId);
        conversation.lastMessage = newMessage._id as Types.ObjectId;
        await conversation.save({ session });
        return { conversation, newMessage, existing: false };
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const concurrent = await ConversationModel.findOne({ directKey });
        if (concurrent) return this.reuse(concurrent);
      }
      throw error;
    }
  }

  private reuse(conversation: InstanceType<typeof ConversationModel>) {
    if (['hidden', 'deleted'].includes(conversation.status)) throw new ErrorUtil('This conversation is unavailable.', 403);
    return { conversation, newMessage: undefined, existing: true };
  }
}
