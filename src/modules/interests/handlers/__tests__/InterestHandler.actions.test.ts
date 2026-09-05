import { Types } from 'mongoose';
import { ConversationModel } from '../../../messaging/models/Conversation';
import { AthleteTeamInterestModel } from '../../models/AthleteTeamInterest';
import TeamModel from '../../../profiles/team/model/TeamModel';
import { InterestHandler } from '../InterestHandler';

describe('InterestHandler team actions', () => {
  const teamId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const athleteId = new Types.ObjectId();
  const interestId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(TeamModel, 'findOne').mockResolvedValue({ _id: teamId } as any);
  });

  it('returns and records an existing conversation without requiring a message', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const interest: any = { _id: interestId, athleteProfile: athleteId, teamProfile: teamId, status: 'sent', save };
    const conversation: any = { _id: new Types.ObjectId(), participants: { team: teamId, athlete: athleteId }, status: 'active' };
    jest.spyOn(AthleteTeamInterestModel, 'findOne').mockResolvedValue(interest);
    jest.spyOn(ConversationModel, 'findOne').mockResolvedValue(conversation);

    const result = await new InterestHandler().startConversation({ interestId, teamId, userId });

    expect(result).toEqual({ conversation, created: false });
    expect(interest.status).toBe('conversation_started');
    expect(interest.conversation).toEqual(conversation._id);
    expect(save).toHaveBeenCalled();
  });

  it('delegates new conversation creation so the messaging module can preserve agent routing', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const interest: any = { _id: interestId, athleteProfile: athleteId, teamProfile: teamId, status: 'viewed', save };
    const conversation: any = { _id: new Types.ObjectId() };
    const newMessage: any = { _id: new Types.ObjectId() };
    const conversationHandler = {
      startConversation: jest.fn().mockResolvedValue({ conversation, newMessage }),
    } as any;
    jest.spyOn(AthleteTeamInterestModel, 'findOne').mockResolvedValue(interest);
    jest.spyOn(ConversationModel, 'findOne').mockResolvedValue(null);

    const result = await new InterestHandler(conversationHandler).startConversation({
      interestId,
      teamId,
      userId,
      message: ' We would like to talk. ',
    });

    expect(conversationHandler.startConversation).toHaveBeenCalledWith(teamId, athleteId.toString(), userId, 'We would like to talk.');
    expect(result.created).toBe(true);
    expect(interest.status).toBe('conversation_started');
  });

  it('prevents dismissal after a conversation has started', async () => {
    jest.spyOn(AthleteTeamInterestModel, 'findOne').mockResolvedValue({ status: 'conversation_started' } as any);

    await expect(new InterestHandler().dismiss(interestId, teamId, userId)).rejects.toMatchObject({
      code: 'INTEREST_FORBIDDEN',
      statusCode: 409,
    });
  });

  it('requires the authenticated user to be linked to the team', async () => {
    jest.spyOn(TeamModel, 'findOne').mockResolvedValue(null);

    await expect(new InterestHandler().getTeamInterest(interestId, teamId, userId)).rejects.toMatchObject({
      code: 'INTEREST_FORBIDDEN',
      statusCode: 403,
    });
  });
});
