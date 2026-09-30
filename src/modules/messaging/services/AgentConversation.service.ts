import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AgentProfileModel } from '../../profiles/agent/model/AgentProfile';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import TeamModel from '../../profiles/team/model/TeamModel';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { getAthleteRepresentative } from '../utils/athleteRepresentation';

export class AgentConversationService {
  async start(agentId: string, input: { athleteId?: unknown; teamId?: unknown; message?: unknown }) {
    const { athleteId, teamId } = input;
    if (Boolean(athleteId) === Boolean(teamId)) throw new ErrorUtil('Choose one athlete or team recipient.', 400);
    const role = athleteId ? 'athlete' : 'team';
    const recipientId = athleteId || teamId;
    if (typeof recipientId !== 'string' || !Types.ObjectId.isValid(recipientId) || !Types.ObjectId.isValid(agentId)) {
      throw new ErrorUtil('A valid recipient profile is required.', 400);
    }
    const agent = await AgentProfileModel.findById(agentId).lean();
    if (!agent || agent.isActive === false) throw new ErrorUtil('An active agent profile is required.', 403);
    if (role === 'athlete') {
      const athlete = await AthleteModel.findById(recipientId).lean();
      if (!athlete || athlete.isActive === false || !athlete.userId) throw new ErrorUtil('Registered athlete not found.', 404);
      const representative = getAthleteRepresentative(athlete.agent);
      if (representative && (representative.status !== 'active' || String(representative.profile) !== agentId)) {
        throw new ErrorUtil('This athlete is represented. Contact their representative instead.', 403);
      }
    } else {
      const team = await TeamModel.findById(recipientId).lean();
      if (
        !team
        // || team.isActive === false
      )
        throw new ErrorUtil('Team profile not found.', 404);
    }

    const directKey = ['agent', new Types.ObjectId(agentId).toHexString(), role, new Types.ObjectId(recipientId).toHexString()].join(':');
    const existing = await ConversationModel.findOne({ directKey });
    if (existing) return this.reuse(existing);
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!message || message.length > 2000) throw new ErrorUtil('A message between 1 and 2000 characters is required.', 400);

    try {
      // Persist the first message and thread together. The unique directKey
      // index also prevents simultaneous requests from creating two threads.
      return await ConversationModel.db.transaction(async (session) => {
        const [conversation] = await ConversationModel.create(
          [
            {
              directKey,
              participants: { agent: agentId, [role]: recipientId },
              messages: [],
            },
          ],
          { session }
        );
        const [newMessage] = await MessageModel.create(
          [
            {
              conversation: conversation._id,
              sender: { role: 'agent', profile: agentId },
              receiver: { role, profile: recipientId },
              content: message,
            },
          ],
          { session }
        );
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
