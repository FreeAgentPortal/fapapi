import { Types } from 'mongoose';
import BillingAccount from '../../../auth/model/BillingAccount';
import { AthleteModel } from '../../../profiles/athlete/models/AthleteModel';
import { InterestQuotaUsageModel } from '../../models/InterestQuotaUsage';
import { InterestHandler } from '../InterestHandler';

describe('InterestHandler quota eligibility', () => {
  const athleteId = new Types.ObjectId();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(AthleteModel, 'findById').mockResolvedValue({ _id: athleteId, isActive: true } as any);
    jest.spyOn(InterestQuotaUsageModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
  });

  function mockBilling(billing: any): void {
    jest.spyOn(BillingAccount, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(billing) }),
    } as any);
  }

  it.each([
    ['Athlete Basic', 0],
    ['Rookie', 3],
    ['Allstar', 10],
    ['Elite', 25],
  ])('returns the configured %s allowance', async (_name, limit) => {
    mockBilling({ status: 'active', needsUpdate: false, entitlements: { teamInterestsPerMonth: limit } });

    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit, used: 0, remaining: limit });
  });

  it('allows a trialing account in good standing', async () => {
    mockBilling({ status: 'trialing', needsUpdate: false, entitlements: { teamInterestsPerMonth: 10 } });
    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit: 10 });
  });

  it.each(['suspended', 'inactive'])('gives a %s account no allowance', async (status) => {
    mockBilling({ status, needsUpdate: false, entitlements: { teamInterestsPerMonth: 25 } });
    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit: 0, remaining: 0 });
  });

  it('gives missing and payment-update accounts no allowance', async () => {
    mockBilling(null);
    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit: 0 });

    jest.restoreAllMocks();
    jest.spyOn(AthleteModel, 'findById').mockResolvedValue({ _id: athleteId, isActive: true } as any);
    jest.spyOn(InterestQuotaUsageModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
    mockBilling({ status: 'active', needsUpdate: true, entitlements: { teamInterestsPerMonth: 25 } });
    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit: 0 });
  });

  it('uses the populated plan for a legacy active account with no billing snapshot', async () => {
    mockBilling({
      status: 'active',
      needsUpdate: false,
      entitlements: { teamInterestsPerMonth: null },
      plan: { entitlements: { teamInterestsPerMonth: 3 } },
    });
    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit: 3 });
  });

  it('applies upgrades and downgrades against current-month usage immediately', async () => {
    jest.spyOn(InterestQuotaUsageModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue({ used: 10 }) } as any);

    mockBilling({ status: 'active', needsUpdate: false, entitlements: { teamInterestsPerMonth: 25 } });
    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit: 25, used: 10, remaining: 15 });

    jest.restoreAllMocks();
    jest.spyOn(AthleteModel, 'findById').mockResolvedValue({ _id: athleteId, isActive: true } as any);
    jest.spyOn(InterestQuotaUsageModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue({ used: 10 }) } as any);
    mockBilling({ status: 'active', needsUpdate: false, entitlements: { teamInterestsPerMonth: 3 } });
    await expect(new InterestHandler().getQuota(athleteId.toString())).resolves.toMatchObject({ limit: 3, used: 10, remaining: 0 });
  });

  it('starts a new UTC month with zero usage when no usage document exists', async () => {
    mockBilling({ status: 'active', needsUpdate: false, entitlements: { teamInterestsPerMonth: 3 } });
    const quota = await new InterestHandler().getQuota(athleteId.toString(), new Date('2026-04-01T00:00:00.000Z'));

    expect(quota).toMatchObject({ period: '2026-04', used: 0, remaining: 3 });
    expect(quota.resetsAt.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });
});
