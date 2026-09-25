import mongoose, { Types } from 'mongoose';
import BillingAccount from '../../../auth/model/BillingAccount';
import { AthleteModel } from '../../../profiles/athlete/models/AthleteModel';
import TeamModel from '../../../profiles/team/model/TeamModel';
import { AthleteTeamInterestModel } from '../../models/AthleteTeamInterest';
import { InterestQuotaUsageModel } from '../../models/InterestQuotaUsage';
import { InterestHandler } from '../InterestHandler';

describe('InterestHandler expression validation and limits', () => {
  const athleteId = new Types.ObjectId();
  const teamId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const now = new Date('2026-06-30T12:00:00.000Z');

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function mockEligibleBase(limit = 3) {
    jest.spyOn(AthleteModel, 'findById').mockResolvedValue({ _id: athleteId, isActive: true } as any);
    jest.spyOn(TeamModel, 'findById').mockResolvedValue({
      _id: teamId,
      isActive: true,
      openToTryouts: true,
      isActivelyRecruiting: true,
      linkedUsers: [{ user: userId }],
    } as any);
    jest.spyOn(BillingAccount, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ status: 'active', needsUpdate: false, entitlements: { teamInterestsPerMonth: limit } }),
      }),
    } as any);
  }

  function mockSession() {
    const session = {
      withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);
    return session;
  }

  it('trims and stores a plain-text note when the 90-day boundary is reached', async () => {
    mockEligibleBase();
    mockSession();
    const current: any = {
      athleteProfile: athleteId,
      teamProfile: teamId,
      initiatedByUser: userId,
      status: 'dismissed',
      note: 'old',
      lastExpressedAt: new Date('2026-04-01T12:00:00.000Z'),
      viewedAt: new Date(),
      dismissedAt: new Date(),
      conversationStartedAt: new Date(),
      conversation: new Types.ObjectId(),
      expressions: [],
    };
    current.save = jest.fn().mockImplementation(async () => current);
    jest.spyOn(AthleteTeamInterestModel, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(current) } as any);
    const usage: any = { used: 0, limitSnapshot: 3 };
    usage.save = jest.fn().mockImplementation(async () => usage);
    jest.spyOn(InterestQuotaUsageModel, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(usage) } as any);

    const result = await new InterestHandler().expressInterest({
      athleteProfileId: athleteId.toString(),
      initiatedByUserId: userId.toString(),
      teamId: teamId.toString(),
      note: '  <b>I am interested</b>  ',
      now,
    });

    expect(result.interest.note).toBe('<b>I am interested</b>');
    expect(result.interest.status).toBe('sent');
    expect(result.interest.dismissedAt).toBeUndefined();
    expect(result.interest.expressions).toContainEqual({
      expressedAt: now,
      note: '<b>I am interested</b>',
      quotaPeriod: '2026-06',
    });
    expect(result.quota).toMatchObject({ limit: 3, used: 1, remaining: 2 });
  });

  it('blocks re-expression immediately before the 90-day boundary without consuming quota', async () => {
    mockEligibleBase();
    mockSession();
    jest.spyOn(AthleteTeamInterestModel, 'findOne').mockReturnValue({
      session: jest.fn().mockResolvedValue({ lastExpressedAt: new Date('2026-04-01T12:00:00.001Z') }),
    } as any);
    const quotaFind = jest.spyOn(InterestQuotaUsageModel, 'findOne');

    await expect(
      new InterestHandler().expressInterest({
        athleteProfileId: athleteId.toString(),
        initiatedByUserId: userId.toString(),
        teamId: teamId.toString(),
        now,
      })
    ).rejects.toMatchObject({ code: 'INTEREST_COOLDOWN', statusCode: 409 });
    expect(quotaFind).not.toHaveBeenCalled();
  });

  it('rejects an exhausted monthly allowance with a stable error code', async () => {
    mockEligibleBase(3);
    mockSession();
    jest.spyOn(AthleteTeamInterestModel, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as any);
    jest.spyOn(InterestQuotaUsageModel, 'findOne').mockReturnValue({
      session: jest.fn().mockResolvedValue({ used: 3, limitSnapshot: 3 }),
    } as any);

    await expect(
      new InterestHandler().expressInterest({
        athleteProfileId: athleteId.toString(),
        initiatedByUserId: userId.toString(),
        teamId: teamId.toString(),
        now,
      })
    ).rejects.toMatchObject({ code: 'INTEREST_LIMIT_REACHED', statusCode: 429 });
  });

  it('rejects plans without the entitlement before opening a transaction', async () => {
    mockEligibleBase(0);
    const sessionSpy = jest.spyOn(mongoose, 'startSession');

    await expect(
      new InterestHandler().expressInterest({
        athleteProfileId: athleteId.toString(),
        initiatedByUserId: userId.toString(),
        teamId: teamId.toString(),
      })
    ).rejects.toMatchObject({ code: 'INTEREST_NOT_INCLUDED', statusCode: 403 });
    expect(sessionSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', { isActive: false, openToTryouts: true, linkedUsers: [{ user: userId }] }],
    ['unclaimed', { isActive: true, openToTryouts: true, linkedUsers: [] }],
    ['closed to tryouts', { isActive: true, openToTryouts: false, linkedUsers: [{ user: userId }] }],
  ])('rejects a team that is %s', async (_label, team) => {
    jest.spyOn(AthleteModel, 'findById').mockResolvedValue({ _id: athleteId, isActive: true } as any);
    jest.spyOn(TeamModel, 'findById').mockResolvedValue({ _id: teamId, ...team } as any);

    await expect(
      new InterestHandler().expressInterest({
        athleteProfileId: athleteId.toString(),
        initiatedByUserId: userId.toString(),
        teamId: teamId.toString(),
      })
    ).rejects.toMatchObject({ code: 'TEAM_NOT_ELIGIBLE' });
  });

  it('rejects notes over 280 characters before querying profiles', async () => {
    const athleteFind = jest.spyOn(AthleteModel, 'findById');

    await expect(
      new InterestHandler().expressInterest({
        athleteProfileId: athleteId.toString(),
        initiatedByUserId: userId.toString(),
        teamId: teamId.toString(),
        note: 'x'.repeat(281),
      })
    ).rejects.toMatchObject({ code: 'INTEREST_FORBIDDEN', statusCode: 400 });
    expect(athleteFind).not.toHaveBeenCalled();
  });
});
