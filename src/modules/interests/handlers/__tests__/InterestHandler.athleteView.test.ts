import { Types } from 'mongoose';
import { AthleteModel } from '../../../profiles/athlete/models/AthleteModel';
import { AthleteTeamInterestModel } from '../../models/AthleteTeamInterest';
import { InterestHandler } from '../InterestHandler';

describe('InterestHandler athlete-facing history', () => {
  afterEach(() => jest.restoreAllMocks());

  it('redacts an internal dismissal as viewed', async () => {
    const athleteId = new Types.ObjectId();
    const dismissedAt = new Date('2026-05-02T12:00:00.000Z');
    jest.spyOn(AthleteModel, 'findById').mockResolvedValue({ _id: athleteId, isActive: true } as any);
    const chain: any = {};
    chain.populate = jest.fn().mockReturnValue(chain);
    chain.sort = jest.fn().mockReturnValue(chain);
    chain.skip = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.lean = jest.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        athleteProfile: athleteId,
        teamProfile: new Types.ObjectId(),
        status: 'dismissed',
        dismissedAt,
        lastExpressedAt: new Date('2026-05-01T12:00:00.000Z'),
      },
    ]);
    jest.spyOn(AthleteTeamInterestModel, 'find').mockReturnValue(chain);
    jest.spyOn(AthleteTeamInterestModel, 'countDocuments').mockResolvedValue(1);

    const result = await new InterestHandler().getAthleteInterests(athleteId.toString(), { page: 1, limit: 20 });

    expect(result.entries[0].status).toBe('viewed');
    expect(result.entries[0]).not.toHaveProperty('dismissedAt');
  });

  it('caps batch status checks at 50 team IDs', async () => {
    const athleteId = new Types.ObjectId();
    jest.spyOn(AthleteModel, 'findById').mockResolvedValue({ _id: athleteId, isActive: true } as any);
    const ids = Array.from({ length: 51 }, () => new Types.ObjectId().toString());

    await expect(new InterestHandler().getAthleteTeamStatuses(athleteId.toString(), ids)).rejects.toMatchObject({
      code: 'INTEREST_FORBIDDEN',
      statusCode: 400,
    });
  });
});
