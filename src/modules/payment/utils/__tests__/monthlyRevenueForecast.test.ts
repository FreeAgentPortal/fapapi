import {
  buildMissingForecastSnapshots, collectedForecastsByMonth, resolveMonthlyForecasts,
} from '../monthlyRevenueForecast';
import { projectExistingSubscriptions } from '../yearlyRevenueProjection';

const now = new Date('2026-10-21T12:00:00Z');
const end = new Date('2027-01-01T00:00:00Z');
const billing = {
  _id: 'account', profileType: 'athlete', status: 'active', plan: { name: 'Plan', price: 100 },
  vaulted: true, needsUpdate: false, nextBillingDate: '2026-10-25T00:00:00Z',
};
const timeline = () => projectExistingSubscriptions([billing], now, end).timeline;
const receipt = (overrides: Record<string, unknown> = {}) => ({
  _id: 'receipt', type: 'payment', status: 'succeeded', currency: 'USD', amount: 200,
  transactionDate: '2026-10-01T00:00:00Z', revenueCategory: 'subscription',
  processor: { name: 'stripe', transactionId: 'pi_one' }, ...overrides,
});

describe('monthly forecast history', () => {
  it('backfills successful subscription/proration gross receipts and excludes unrelated or failed records', () => {
    const receipts = [
      receipt(),
      receipt({ _id: 'proration', processor: { name: 'stripe', transactionId: 'pi_two' }, amount: 25, revenueCategory: 'subscription_proration' }),
      receipt({ _id: 'legacy', processor: { name: 'stripe', transactionId: 'pi_three' }, amount: 10, revenueCategory: undefined, description: 'Prorated upgrade charge' }),
      ...[
        { status: 'failed' }, { currency: 'EUR' }, { type: 'refund' }, { amount: 0 },
        { revenueCategory: 'setup_fee', description: 'Subscription setup fee' },
        { revenueCategory: 'other', description: 'Other subscription-related payment' },
        { processor: { name: 'paynetworx' } }, { transactionDate: '2025-12-31T23:59:59Z' },
        { transactionDate: now.toISOString() },
      ].map((overrides, index) => receipt({ _id: `excluded-${index}`, ...overrides })),
    ];
    expect(collectedForecastsByMonth(receipts, now).get('2026-10')).toEqual({
      contracted: 235, collectible: 235, atRisk: 0, charges: 3,
    });
  });

  it('deduplicates charge and PaymentIntent aliases even when a recovery bridges earlier receipts', () => {
    const receipts = [
      receipt({ _id: 'one', processor: { name: 'stripe', transactionId: 'ch_one' } }),
      receipt({ _id: 'two' }),
      receipt({ _id: 'recovered', reconciliation: { stripeChargeId: 'ch_one', stripePaymentIntentId: 'pi_one' } }),
    ];
    expect(collectedForecastsByMonth(receipts, now).get('2026-10')?.contracted).toBe(200);
    expect(collectedForecastsByMonth(receipts, now).get('2026-10')?.charges).toBe(1);
  });

  it('uses UTC transaction months and cent arithmetic for successful status aliases', () => {
    const receipts = [
      receipt({ _id: 'a', amount: 0.1, status: 'success', transactionDate: '2026-09-30T23:30:00-04:00' }),
      receipt({ _id: 'b', amount: 0.2, status: 'completed', processor: { name: 'stripe', transactionId: 'pi_b' } }),
    ];
    expect(collectedForecastsByMonth(receipts, now).get('2026-10')?.contracted).toBe(0.3);
  });

  it('initializes current collections plus remaining, backfills empty months, and leaves future months live', () => {
    const snapshots = buildMissingForecastSnapshots(timeline(), [receipt()], [], now);
    expect(snapshots).toHaveLength(10);
    expect(snapshots[0]).toMatchObject({ month: '2026-01', contracted: 0, source: 'receipt_backfill' });
    expect(snapshots[9]).toMatchObject({
      _id: 'USD:2026-10', contracted: 300, collectible: 300, charges: 2, source: 'mid_month_initialization',
    });
    const resolved = resolveMonthlyForecasts(timeline(), [receipt()], snapshots, now);
    expect(resolved[9]).toMatchObject({ contracted: 300, capturedAt: now.toISOString() });
    expect(resolved[10]).toMatchObject({ contracted: 100, source: 'live', capturedAt: null });
  });

  it('does not classify already collected amounts as at risk', () => {
    const atRisk = projectExistingSubscriptions([{ ...billing, vaulted: false }], now, end).timeline;
    expect(resolveMonthlyForecasts(atRisk, [receipt()], [], now)[9]).toMatchObject({
      contracted: 300, collectible: 200, atRisk: 100, source: 'current_month_fallback', capturedAt: null,
    });
  });

  it('keeps the baseline unchanged after payment, cancellation, and price changes', () => {
    const snapshots = buildMissingForecastSnapshots(timeline(), [receipt()], [], now);
    const changed = projectExistingSubscriptions([
      { ...billing, status: 'inactive', plan: { name: 'Changed', price: 900 } },
    ], now, end).timeline;
    const laterReceipts = [receipt({ amount: 500 })];
    expect(resolveMonthlyForecasts(changed, laterReceipts, snapshots, now)[9].contracted).toBe(300);
    expect(buildMissingForecastSnapshots(changed, laterReceipts, snapshots, now)).toEqual([]);
  });

  it('captures the new month at the UTC boundary and uses backfill for a completely missed month', () => {
    const november = new Date('2026-11-01T00:00:00Z');
    const nextTimeline = projectExistingSubscriptions([billing], november, end).timeline;
    const saved = buildMissingForecastSnapshots(nextTimeline, [receipt()], [], november);
    expect(saved[9]).toMatchObject({ month: '2026-10', contracted: 200, source: 'receipt_backfill' });
    expect(saved[10]).toMatchObject({ month: '2026-11', contracted: 100, source: 'month_boundary' });
  });

  it('starts January without copying the previous year or overwriting its snapshots', () => {
    const january = new Date('2027-01-01T00:00:00Z');
    const nextTimeline = projectExistingSubscriptions([], january, new Date('2028-01-01T00:00:00Z')).timeline;
    const saved = buildMissingForecastSnapshots(nextTimeline, [receipt()], [], january);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ _id: 'USD:2027-01', contracted: 0, source: 'month_boundary' });
  });
});
