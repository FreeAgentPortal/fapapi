import BillingAccount from '../../../auth/model/BillingAccount';
import Receipt from '../../models/Receipt';
import MonthlyRevenueForecast from '../../models/MonthlyRevenueForecast';
import { MonthlyRevenueForecastService } from '../MonthlyRevenueForecastService';
import { YearlySubscriptionRevenueHandler } from '../../handlers/YearlySubscriptionRevenue.handler';
import { StripeSubscriptionReconciliation } from '../../classes/StripeSubscriptionReconciliation';
import { buildMissingForecastSnapshots, type StoredMonthlyForecast } from '../../utils/monthlyRevenueForecast';
import { projectExistingSubscriptions } from '../../utils/yearlyRevenueProjection';
import logger from '../../../../utils/logger';

const now = new Date('2026-10-21T12:00:00Z');
const billing = {
  _id: 'billing', profileType: 'athlete', status: 'active', plan: { _id: 'plan', name: 'Plan', price: 100 },
  vaulted: true, nextBillingDate: new Date('2026-11-01T00:00:00Z'),
};
const receipt = {
  _id: 'receipt', billingAccountId: 'billing', type: 'payment', status: 'succeeded', currency: 'USD', amount: 200,
  transactionDate: new Date('2026-10-01T00:00:00Z'), revenueCategory: 'subscription',
  processor: { name: 'stripe', transactionId: 'pi_one' },
};
const query = (value: unknown) => ({
  select: function () { return this; }, populate: function () { return this; }, sort: function () { return this; },
  lean: jest.fn().mockResolvedValue(value),
});

describe('monthly revenue snapshot persistence and reporting', () => {
  let stored: Map<string, StoredMonthlyForecast>;
  beforeEach(() => {
    stored = new Map();
    jest.spyOn(MonthlyRevenueForecast, 'find').mockImplementation(() => query([...stored.values()]) as any);
    jest.spyOn(BillingAccount, 'find').mockReturnValue(query([billing]) as any);
    jest.spyOn(Receipt, 'find').mockReturnValue(query([receipt]) as any);
    jest.spyOn(MonthlyRevenueForecast, 'updateOne').mockImplementation(((filter: any, update: any) => {
      const exists = stored.has(filter._id);
      if (!exists) stored.set(filter._id, structuredClone(update.$setOnInsert));
      return Promise.resolve({ upsertedCount: exists ? 0 : 1 }) as any;
    }) as any);
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'info').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('previews candidates without writing and only requests successful USD Stripe subscription history', async () => {
    const result = await MonthlyRevenueForecastService.initialize(now, true);
    expect(result).toMatchObject({ dryRun: true, inserted: 0 });
    expect(result.candidates).toHaveLength(10);
    expect(MonthlyRevenueForecast.updateOne).not.toHaveBeenCalled();
    expect(Receipt.find).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payment', currency: 'USD', 'processor.name': 'stripe',
      status: { $in: ['success', 'succeeded', 'completed'] },
    }));
  });

  it('inserts immutable records once across repeated/concurrent initialization', async () => {
    const results = await Promise.all([
      MonthlyRevenueForecastService.initialize(now), MonthlyRevenueForecastService.initialize(now),
    ]);
    expect(results.reduce((sum, result) => sum + result.inserted, 0)).toBe(10);
    expect(stored.size).toBe(10);
    expect(MonthlyRevenueForecast.updateOne).toHaveBeenNthCalledWith(1,
      { _id: 'USD:2026-10' }, { $setOnInsert: expect.objectContaining({ contracted: 200 }) },
      { upsert: true, runValidators: true });
    const writes = (MonthlyRevenueForecast.updateOne as jest.Mock).mock.calls.length;
    await MonthlyRevenueForecastService.initialize(now);
    expect(MonthlyRevenueForecast.updateOne).toHaveBeenCalledTimes(writes);
  });

  it('accepts a duplicate-key race but propagates other persistence failures for safe retry', async () => {
    (MonthlyRevenueForecast.updateOne as jest.Mock).mockRejectedValueOnce({ code: 11000 });
    await expect(MonthlyRevenueForecastService.initialize(now)).resolves.toMatchObject({ inserted: 9 });
    (MonthlyRevenueForecast.updateOne as jest.Mock).mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(MonthlyRevenueForecastService.initializeSafely(now)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ month: '2026-10' }), expect.stringContaining('will retry'));
    await MonthlyRevenueForecastService.initializeSafely(now);
    expect(stored.size).toBe(10);
  });

  it('returns saved chart baselines without adding them to remaining-year or scenario totals', async () => {
    const projection = projectExistingSubscriptions([billing], now, new Date('2027-01-01T00:00:00Z'));
    const snapshots = buildMissingForecastSnapshots(projection.timeline, [receipt], [], now);
    snapshots[9].contracted = 900;
    snapshots[9].collectible = 800;
    snapshots[9].atRisk = 100;
    snapshots.forEach((snapshot) => stored.set(snapshot._id, snapshot));
    jest.spyOn(StripeSubscriptionReconciliation.prototype, 'reconcilePeriod').mockResolvedValue({
      summary: {
        grossCaptured: 200, refunds: 0, fees: 0, netReceived: 200, successfulPayments: 1,
        failedChargeAttempts: 0, unmatchedSuccessfulCharges: 0, unmatchedSuccessfulAmount: 0,
        missingBalanceTransactions: 0, netIsEstimated: false, proratedGrossCaptured: 0, proratedSuccessfulPayments: 0,
      },
      matchedCharges: [{ id: 'ch_one', payment_intent: 'pi_one', amount_captured: 20000, created: receipt.transactionDate.getTime() / 1000 }],
      matchedRefunds: [],
    } as any);
    const handler = new YearlySubscriptionRevenueHandler({} as any);
    const baseline = await handler.generateBaseline(now);
    expect(baseline.timeline[9]).toMatchObject({
      actualGrossCaptured: 200, projectedContracted: 0, monthlyForecast: { contracted: 900, collectible: 800 },
    });
    expect(baseline.remainingYearProjection.contracted).toBe(200);
    expect(baseline.projectedFullYear.contractedGross).toBe(400);
    expect(MonthlyRevenueForecast.updateOne).not.toHaveBeenCalled();
    jest.spyOn(handler as any, 'resolveAcquisitions').mockResolvedValue([]);
    const scenario = await handler.generateScenario([], now);
    expect(scenario.scenario.projectedFullYear.contractedGross).toBe(400);
    expect(scenario.scenario.timeline[9].baselineProjectedContracted).toBe(0);
    expect(scenario.scenario.timeline[9].contractedWithGrowth).toBe(0);
  });
});
