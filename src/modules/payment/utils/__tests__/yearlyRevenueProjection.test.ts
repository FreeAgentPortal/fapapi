import mongoose from 'mongoose';
import PlanSchema from '../../../auth/model/PlanSchema';
import { StripeSubscriptionReconciliation } from '../../classes/StripeSubscriptionReconciliation';
import { YearlySubscriptionRevenueHandler } from '../../handlers/YearlySubscriptionRevenue.handler';
import {
  projectAcquisitionScenario,
  projectExistingSubscriptions,
  type ProjectionBillingAccount,
  type ResolvedAcquisition,
} from '../yearlyRevenueProjection';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const YEAR_END = new Date('2027-01-01T00:00:00.000Z');

const monthlyPlan = {
  _id: 'monthly-plan',
  name: 'Monthly',
  price: 100,
  yearlyDiscount: 10,
};

function billing(overrides: Partial<ProjectionBillingAccount> = {}): ProjectionBillingAccount {
  return {
    _id: overrides._id ?? new mongoose.Types.ObjectId(),
    profileType: 'athlete',
    status: 'active',
    plan: monthlyPlan,
    isYearly: false,
    nextBillingDate: new Date('2026-09-01T00:00:00.000Z'),
    credits: 0,
    vaulted: true,
    needsUpdate: false,
    pendingCancellation: false,
    ...overrides,
  };
}

describe('yearly subscription projection', () => {
  it('repeats monthly subscriptions through December and applies credits only once', () => {
    const result = projectExistingSubscriptions([billing({ credits: 50 })], NOW, YEAR_END);

    expect(result.totals).toEqual({ contracted: 350, collectible: 350, atRisk: 0, charges: 4 });
    expect(result.timeline[8].contracted).toBe(50);
    expect(result.timeline[9].contracted).toBe(100);
    expect(result.timeline[11].contracted).toBe(100);
  });

  it('places an annual discounted renewal only in its due month', () => {
    const result = projectExistingSubscriptions([
      billing({ isYearly: true, nextBillingDate: '2026-10-01T00:00:00.000Z' }),
    ], NOW, YEAR_END);

    expect(result.totals).toEqual({ contracted: 1080, collectible: 1080, atRisk: 0, charges: 1 });
    expect(result.timeline[9].contracted).toBe(1080);
    expect(result.timeline.filter((month) => month.contracted > 0)).toHaveLength(1);
    expect(result.runRate.contractedMrr).toBe(90);
    expect(result.runRate.contractedArr).toBe(1080);
  });

  it('applies a scheduled plan and cycle change from its effective billing date', () => {
    const upgradedPlan = { _id: 'upgraded-plan', name: 'Upgraded', price: 200, yearlyDiscount: 0 };
    const result = projectExistingSubscriptions([
      billing({
        scheduledPlanChange: {
          plan: upgradedPlan,
          effectiveDate: '2026-10-01T00:00:00.000Z',
          isYearly: false,
        },
      }),
    ], NOW, YEAR_END);

    expect(result.totals.contracted).toBe(700);
    expect(result.timeline[8].contracted).toBe(100);
    expect(result.timeline[9].contracted).toBe(200);
    expect(result.breakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ planId: 'monthly-plan', contracted: 100 }),
      expect.objectContaining({ planId: 'upgraded-plan', contracted: 600 }),
    ]));
  });

  it('separates collectible revenue from at-risk revenue', () => {
    const result = projectExistingSubscriptions([
      billing(),
      billing({ vaulted: false }),
      billing({ needsUpdate: true }),
    ], NOW, YEAR_END);

    expect(result.totals).toEqual({ contracted: 1200, collectible: 400, atRisk: 800, charges: 12 });
    expect(result.runRate).toEqual(expect.objectContaining({
      contractedMrr: 300,
      collectibleMrr: 100,
      atRiskMrr: 200,
    }));
  });

  it('excludes pending cancellations, suspended accounts, and inactive accounts', () => {
    const result = projectExistingSubscriptions([
      billing({ pendingCancellation: true }),
      billing({ status: 'suspended' }),
      billing({ status: 'inactive' }),
    ], NOW, YEAR_END);

    expect(result.totals.contracted).toBe(0);
    expect(result.excluded).toEqual(expect.objectContaining({
      pendingCancellation: 1,
      suspended: 1,
      inactive: 1,
    }));
  });

  it('projects an overdue eligible subscription once immediately and then resumes monthly', () => {
    const result = projectExistingSubscriptions([
      billing({ nextBillingDate: '2026-07-01T00:00:00.000Z' }),
    ], NOW, YEAR_END);

    expect(result.totals).toEqual({ contracted: 500, collectible: 500, atRisk: 0, charges: 5 });
    expect(result.timeline[7].contracted).toBe(100);
    expect(result.timeline[8].contracted).toBe(100);
  });
});

describe('acquisition scenarios', () => {
  const acquisition = (
    overrides: Partial<ResolvedAcquisition> = {}
  ): ResolvedAcquisition => ({
    profileType: 'athlete',
    planId: 'plan-id',
    planName: 'Growth plan',
    planPrice: 100,
    yearlyDiscount: 10,
    billingCycle: 'monthly',
    newSubscribersPerMonth: 10,
    ...overrides,
  });

  it('starts cash collection in the month after signup for monthly cohorts', () => {
    const result = projectAcquisitionScenario([acquisition()], NOW, YEAR_END);

    expect(result.totals).toEqual({
      addedCurrentYearCollections: 10000,
      acquiredSubscribers: 50,
      exitMrr: 5000,
      exitArr: 60000,
    });
    expect(result.timeline[7]).toEqual(expect.objectContaining({ newSubscribers: 10, collections: 0 }));
    expect(result.timeline[8].collections).toBe(1000);
    expect(result.timeline[11].collections).toBe(4000);
  });

  it('charges annual cohorts once and normalizes their exit run rate over 12 months', () => {
    const result = projectAcquisitionScenario([
      acquisition({ billingCycle: 'yearly' }),
    ], NOW, YEAR_END);

    expect(result.totals).toEqual({
      addedCurrentYearCollections: 43200,
      acquiredSubscribers: 50,
      exitMrr: 4500,
      exitArr: 54000,
    });
    expect(result.timeline[8].collections).toBe(10800);
    expect(result.timeline[11].collections).toBe(10800);
  });

  it('gives December signups exit run rate without current-year cash', () => {
    const december = new Date('2026-12-10T12:00:00.000Z');
    const result = projectAcquisitionScenario([acquisition()], december, YEAR_END);

    expect(result.totals).toEqual({
      addedCurrentYearCollections: 0,
      acquiredSubscribers: 10,
      exitMrr: 1000,
      exitArr: 12000,
    });
  });
});

describe('Stripe subscription reconciliation', () => {
  it('includes recurring, prorated, and recovered receipts while excluding setup and unmatched charges', async () => {
    const balance = (id: string, net: number) => ({ id, net });
    const charges = [
      { id: 'ch_recurring', payment_intent: 'pi_recurring', status: 'succeeded', amount_captured: 10000, balance_transaction: balance('bt_1', 9700) },
      { id: 'ch_proration', payment_intent: 'pi_proration', status: 'succeeded', amount_captured: 2500, balance_transaction: balance('bt_2', 2425) },
      { id: 'ch_recovered', payment_intent: null, status: 'succeeded', amount_captured: 5000, balance_transaction: balance('bt_3', 4850) },
      { id: 'ch_setup', payment_intent: 'pi_setup', status: 'succeeded', amount_captured: 1500, balance_transaction: balance('bt_4', 1455) },
      { id: 'ch_unmatched', payment_intent: 'pi_unmatched', status: 'succeeded', amount_captured: 3000, balance_transaction: balance('bt_5', 2910) },
      { id: 'ch_failed', payment_intent: 'pi_failed', status: 'failed', amount_captured: 0, balance_transaction: null },
    ];
    const refunds = [
      { id: 're_1', charge: 'ch_recurring', payment_intent: 'pi_recurring', amount: 1000, balance_transaction: balance('bt_r1', -1000), created: 1 },
      { id: 're_2', charge: 'ch_recovered', payment_intent: null, amount: 500, balance_transaction: balance('bt_r2', -500), created: 1 },
    ];
    const stripe = {
      charges: { list: jest.fn().mockResolvedValue({ data: charges, has_more: false }) },
      refunds: { list: jest.fn().mockResolvedValue({ data: refunds, has_more: false }) },
    };
    const reconciler = new StripeSubscriptionReconciliation(stripe as any);

    const result = await reconciler.reconcilePeriod(
      new Date('2026-01-01T00:00:00.000Z'),
      NOW,
      new Set(['pi_recurring', 'pi_proration', 'ch_recovered']),
      new Set(['pi_proration'])
    );

    expect(result.summary).toEqual({
      grossCaptured: 175,
      refunds: 15,
      fees: 5.25,
      netReceived: 154.75,
      successfulPayments: 3,
      failedChargeAttempts: 1,
      unmatchedSuccessfulCharges: 2,
      unmatchedSuccessfulAmount: 45,
      missingBalanceTransactions: 0,
      netIsEstimated: false,
      proratedGrossCaptured: 25,
      proratedSuccessfulPayments: 1,
    });
    expect(result.matchedCharges.map((charge) => charge.id)).toEqual([
      'ch_recurring',
      'ch_proration',
      'ch_recovered',
    ]);
  });
});

describe('scenario request validation', () => {
  const handler = new YearlySubscriptionRevenueHandler({} as any);
  const validPlanId = new mongoose.Types.ObjectId().toString();
  const resolve = (rows: any[]) => (handler as any).resolveAcquisitions(rows);

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['profile type', [{ profileType: 'team', planId: validPlanId, billingCycle: 'monthly', newSubscribersPerMonth: 10 }], 'profileType is not supported'],
    ['billing cycle', [{ profileType: 'athlete', planId: validPlanId, billingCycle: 'weekly', newSubscribersPerMonth: 10 }], 'billingCycle must be monthly or yearly'],
    ['negative count', [{ profileType: 'athlete', planId: validPlanId, billingCycle: 'monthly', newSubscribersPerMonth: -1 }], 'must be a nonnegative integer'],
  ])('rejects an invalid %s', async (_label, rows, message) => {
    await expect(resolve(rows)).rejects.toThrow(message);
  });

  it('rejects duplicate profile, plan, and billing-cycle rows', async () => {
    const row = { profileType: 'athlete', planId: validPlanId, billingCycle: 'monthly', newSubscribersPerMonth: 10 };
    await expect(resolve([row, row])).rejects.toThrow('Duplicate acquisition row');
  });

  it('rejects a missing or inactive plan and accepts an active profile-compatible plan', async () => {
    const row = { profileType: 'athlete', planId: validPlanId, billingCycle: 'monthly', newSubscribersPerMonth: 10 };
    const find = jest.spyOn(PlanSchema, 'find');
    find.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue([]) } as any);
    await expect(resolve([row])).rejects.toThrow('planId was not found');

    find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([{
        _id: validPlanId,
        name: 'Inactive',
        price: 100,
        yearlyDiscount: 10,
        availableTo: ['athlete'],
        isActive: false,
      }]),
    } as any);
    await expect(resolve([row])).rejects.toThrow('inactive plan');

    find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([{
        _id: validPlanId,
        name: 'Active',
        price: 100,
        yearlyDiscount: 10,
        availableTo: ['athlete'],
        isActive: true,
      }]),
    } as any);
    await expect(resolve([row])).resolves.toEqual([
      expect.objectContaining({ planId: validPlanId, planName: 'Active', planPrice: 100 }),
    ]);
  });
});
