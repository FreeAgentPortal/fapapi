import BillingAccount from '../../auth/model/BillingAccount';
import Receipt from '../models/Receipt';
import MonthlyRevenueForecast from '../models/MonthlyRevenueForecast';
import { buildSubscriptionReceiptQuery } from '../utils/subscriptionRevenue';
import { projectExistingSubscriptions } from '../utils/yearlyRevenueProjection';
import { buildMissingForecastSnapshots, forecastId, utcMonthKey, type StoredMonthlyForecast } from '../utils/monthlyRevenueForecast';
import logger from '../../../utils/logger';

export class MonthlyRevenueForecastService {
  static async getSnapshots(year: number): Promise<StoredMonthlyForecast[]> {
    return MonthlyRevenueForecast.find({
      _id: { $gte: forecastId(`${year}-01`), $lt: forecastId(`${year + 1}-01`) },
    }).lean();
  }

  static async initialize(now = new Date(), dryRun = false) {
    const year = now.getUTCFullYear();
    const snapshots = await this.getSnapshots(year);
    const existingMonths = new Set(snapshots.map((snapshot) => snapshot.month));
    const complete = Array.from({ length: now.getUTCMonth() + 1 }, (_, index) =>
      `${year}-${String(index + 1).padStart(2, '0')}`).every((month) => existingMonths.has(month));
    if (complete) return { dryRun, candidates: [], inserted: 0 };

    const [receipts, billings] = await Promise.all([
      Receipt.find({
        ...buildSubscriptionReceiptQuery(new Date(Date.UTC(year, 0, 1)), now, { successfulOnly: true, stripeOnly: true }),
        currency: 'USD',
      }).select('_id type status amount currency transactionDate revenueCategory description processor reconciliation').lean(),
      BillingAccount.find({}).select(
        '_id profileType status plan isYearly nextBillingDate credits vaulted needsUpdate pendingCancellation scheduledPlanChange'
      ).populate('plan').populate('scheduledPlanChange.plan').lean(),
    ]);
    const projection = projectExistingSubscriptions(billings as any[], now, new Date(Date.UTC(year + 1, 0, 1)));
    const candidates = buildMissingForecastSnapshots(projection.timeline, receipts, snapshots, now);
    let inserted = 0;
    if (!dryRun) {
      // Prioritize the current baseline before doing historical backfill.
      for (const snapshot of [...candidates].reverse()) {
        try {
          const result = await MonthlyRevenueForecast.updateOne(
            { _id: snapshot._id }, { $setOnInsert: snapshot }, { upsert: true, runValidators: true }
          );
          inserted += result.upsertedCount;
        } catch (error: any) {
          // Another worker may insert the same immutable snapshot concurrently.
          if (error?.code !== 11000) throw error;
        }
      }
    }
    return { dryRun, candidates, inserted };
  }

  static async initializeSafely(now = new Date()): Promise<void> {
    try {
      const result = await this.initialize(now);
      if (result.inserted) logger.info({ inserted: result.inserted }, '[RevenueForecast] Monthly baselines saved');
    } catch (error) {
      logger.error({ error, month: utcMonthKey(now) },
        '[RevenueForecast] Could not save monthly baselines; will retry before the next billing run. Payment collection remains enabled.');
    }
  }
}
