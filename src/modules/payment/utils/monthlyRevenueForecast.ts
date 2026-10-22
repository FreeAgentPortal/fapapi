import type { ProjectionMonth } from './yearlyRevenueProjection';
import { SUBSCRIPTION_REVENUE_CATEGORIES } from './subscriptionRevenue';

export const FORECAST_CALCULATION_VERSION = 2;
export type SnapshotSource = 'month_boundary' | 'receipt_backfill' | 'mid_month_initialization';
export type MonthlyForecastSource = SnapshotSource | 'live' | 'receipt_fallback' | 'current_month_fallback';

export type ForecastAmounts = Pick<ProjectionMonth, 'contracted' | 'collectible' | 'atRisk' | 'charges'>;
export type MonthlyForecast = ForecastAmounts & {
  source: MonthlyForecastSource;
  capturedAt: string | null;
};
export type StoredMonthlyForecast = ForecastAmounts & {
  _id: string;
  month: string;
  currency: 'USD';
  timezone: 'UTC';
  capturedAt: Date;
  calculationVersion: number;
  source: SnapshotSource;
};

type ForecastReceipt = {
  _id?: unknown;
  type?: string;
  status?: string;
  currency?: string;
  amount: number;
  transactionDate: Date | string;
  revenueCategory?: string;
  description?: string;
  processor?: { name?: string; transactionId?: string };
  reconciliation?: { stripeChargeId?: string; stripePaymentIntentId?: string };
};

export function utcMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function forecastId(month: string): string {
  return `USD:${month}`;
}

export function emptyForecastAmounts(): ForecastAmounts {
  return { contracted: 0, collectible: 0, atRisk: 0, charges: 0 };
}

/** Receipt history represents successful gross collections, not past account state. */
export function collectedForecastsByMonth(receipts: ForecastReceipt[], now: Date): Map<string, ForecastAmounts> {
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1);
  const eligible = receipts.filter((receipt) => {
    const time = new Date(receipt.transactionDate).getTime();
    const subscription = SUBSCRIPTION_REVENUE_CATEGORIES.some((category) => category === receipt.revenueCategory)
      || (!receipt.revenueCategory && /subscription|prorated upgrade charge/i.test(receipt.description ?? ''));
    return receipt.type === 'payment' && ['success', 'succeeded', 'completed'].includes(receipt.status ?? '')
      && receipt.currency === 'USD' && receipt.processor?.name === 'stripe' && subscription
      && Number.isFinite(receipt.amount) && receipt.amount > 0 && time >= yearStart && time < now.getTime();
  }).sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  // Union aliases before summing: a recovered receipt may bridge a charge ID
  // and a PaymentIntent ID that previously appeared on separate receipts.
  const parents = eligible.map((_, index) => index);
  const root = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const identities = new Map<string, number>();
  eligible.forEach((receipt, index) => {
    const aliases = [receipt.processor?.transactionId, receipt.reconciliation?.stripeChargeId,
      receipt.reconciliation?.stripePaymentIntentId].filter((id): id is string => Boolean(id && /^(pi_|ch_)/.test(id)));
    if (receipt._id != null) aliases.push(`receipt:${String(receipt._id)}`);
    for (const alias of aliases) {
      const previous = identities.get(alias);
      if (previous !== undefined) {
        const first = root(previous);
        const second = root(index);
        parents[Math.max(first, second)] = Math.min(first, second);
      }
      identities.set(alias, index);
    }
  });

  const collected = new Map<string, ForecastAmounts>();
  eligible.forEach((receipt, index) => {
    if (root(index) !== index) return;
    const month = utcMonthKey(new Date(receipt.transactionDate));
    const totals = collected.get(month) ?? emptyForecastAmounts();
    totals.contracted = addMoney(totals.contracted, receipt.amount);
    totals.collectible = totals.contracted;
    totals.charges += 1;
    collected.set(month, totals);
  });
  return collected;
}

export function resolveMonthlyForecasts(
  timeline: ProjectionMonth[],
  receipts: ForecastReceipt[],
  snapshots: StoredMonthlyForecast[],
  now: Date
): MonthlyForecast[] {
  const currentMonth = utcMonthKey(now);
  const saved = new Map(snapshots.map((snapshot) => [snapshot.month, snapshot]));
  const collected = collectedForecastsByMonth(receipts, now);
  return timeline.map((month) => {
    const snapshot = saved.get(month.month);
    if (snapshot && month.month <= currentMonth) {
      return {
        ...amounts(snapshot), source: snapshot.source, capturedAt: new Date(snapshot.capturedAt).toISOString(),
      };
    }
    if (month.month > currentMonth) return { ...amounts(month), source: 'live', capturedAt: null };
    const actual = collected.get(month.month) ?? emptyForecastAmounts();
    if (month.month < currentMonth) return { ...actual, source: 'receipt_fallback', capturedAt: null };
    return {
      contracted: addMoney(actual.contracted, month.contracted),
      collectible: addMoney(actual.collectible, month.collectible),
      atRisk: month.atRisk,
      charges: actual.charges + month.charges,
      source: 'current_month_fallback', capturedAt: null,
    };
  });
}

export function buildMissingForecastSnapshots(
  timeline: ProjectionMonth[],
  receipts: ForecastReceipt[],
  snapshots: StoredMonthlyForecast[],
  now: Date
): StoredMonthlyForecast[] {
  const savedMonths = new Set(snapshots.map((snapshot) => snapshot.month));
  const currentMonth = utcMonthKey(now);
  const boundary = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const forecasts = resolveMonthlyForecasts(timeline, receipts, snapshots, now);
  return timeline.flatMap((month, index) => {
    if (month.month > currentMonth || savedMonths.has(month.month)) return [];
    return [{
      ...amounts(forecasts[index]),
      _id: forecastId(month.month), month: month.month, currency: 'USD' as const, timezone: 'UTC' as const,
      capturedAt: new Date(now), calculationVersion: FORECAST_CALCULATION_VERSION,
      source: month.month < currentMonth ? 'receipt_backfill' as const
        : now.getTime() - boundary < 60_000 ? 'month_boundary' as const : 'mid_month_initialization' as const,
    }];
  });
}

function amounts(value: ForecastAmounts): ForecastAmounts {
  return { contracted: value.contracted, collectible: value.collectible, atRisk: value.atRisk, charges: value.charges };
}

function addMoney(left: number, right: number): number {
  return (Math.round(left * 100) + Math.round(right * 100)) / 100;
}
