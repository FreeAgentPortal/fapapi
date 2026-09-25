import Stripe from 'stripe';
import BillingAccount from '../../auth/model/BillingAccount';
import Receipt from '../models/Receipt';
import { calculatePlanCycleAmount } from '../utils/billingPlanUtils';
import { buildSubscriptionReceiptQuery, isSubscriptionProration } from '../utils/subscriptionRevenue';
import { StripeSubscriptionReconciliation } from '../classes/StripeSubscriptionReconciliation';

type BillingCycle = 'monthly' | 'yearly';

type RevenueBucket = {
  amount: number;
  subscriptions: number;
};

type RevenueBreakdown = Record<BillingCycle, RevenueBucket>;

const SUCCESSFUL_RECEIPT_STATUSES = new Set(['success', 'succeeded', 'completed']);

export class SubscriptionRevenueReportHandler {
  private readonly stripeReconciliation: StripeSubscriptionReconciliation;

  constructor(stripe?: Stripe) {
    this.stripeReconciliation = new StripeSubscriptionReconciliation(stripe);
  }

  public async generateReport(now: Date = new Date()) {
    const currentMonthStart = this.startOfUtcMonth(now);
    const nextMonthStart = this.addUtcMonths(currentMonthStart, 1);
    const followingMonthStart = this.addUtcMonths(currentMonthStart, 2);

    const [subscriptionReceipts, currentDueBillings, projectedBillings, activeBillings] = await Promise.all([
      Receipt.find(buildSubscriptionReceiptQuery(currentMonthStart, nextMonthStart))
        .select('billingAccountId amount currency status planInfo processor transactionDate description revenueCategory')
        .sort({ transactionDate: 1 })
        .lean(),
      this.findScheduledBillings(currentMonthStart, nextMonthStart),
      this.findScheduledBillings(nextMonthStart, followingMonthStart),
      BillingAccount.find({
        status: { $in: ['active', 'trialing'] },
        pendingCancellation: { $ne: true },
        plan: { $exists: true, $ne: null },
      })
        .populate('plan')
        .lean(),
    ]);

    const expectedByBillingAccount = new Map<string, { amount: number; cycle: BillingCycle }>();
    const proratedObligations = new Map<string, { amount: number; cycle: BillingCycle }>();
    for (const receipt of subscriptionReceipts as any[]) {
      if (isSubscriptionProration(receipt)) {
        const targetPlanId = receipt.planInfo?.planId ? String(receipt.planInfo.planId) : receipt.description ?? 'unknown-plan';
        proratedObligations.set(`${receipt.billingAccountId}:${targetPlanId}`, {
          amount: this.asMoney(receipt.amount),
          cycle: this.toBillingCycle(receipt.planInfo?.billingCycle),
        });
        continue;
      }
      expectedByBillingAccount.set(String(receipt.billingAccountId), {
        amount: this.asMoney(receipt.amount),
        cycle: this.toBillingCycle(receipt.planInfo?.billingCycle),
      });
    }

    for (const billing of currentDueBillings as any[]) {
      const billingId = String(billing._id);
      if (!expectedByBillingAccount.has(billingId)) {
        expectedByBillingAccount.set(billingId, this.getScheduledBillingAmount(billing, billing.nextBillingDate));
      }
    }
    const expectedSubscriptionIds = new Set([
      ...(subscriptionReceipts as any[]).map((receipt) => String(receipt.billingAccountId)),
      ...(currentDueBillings as any[]).map((billing) => String(billing._id)),
    ]);

    const expectedBreakdown = this.emptyBreakdown();
    for (const expected of expectedByBillingAccount.values()) {
      this.addToBreakdown(expectedBreakdown, expected.cycle, expected.amount);
    }
    const prorationBreakdown = this.emptyBreakdown();
    for (const proration of proratedObligations.values()) {
      this.addToBreakdown(expectedBreakdown, proration.cycle, proration.amount);
      this.addToBreakdown(prorationBreakdown, proration.cycle, proration.amount);
    }

    const stripePaymentIntentIds = new Set(
      (subscriptionReceipts as any[])
        .filter((receipt) => SUCCESSFUL_RECEIPT_STATUSES.has(receipt.status) && receipt.processor?.name === 'stripe')
        .map((receipt) => receipt.processor?.transactionId)
        .filter((transactionId): transactionId is string => Boolean(transactionId && transactionId !== 'N/A'))
    );
    const prorationPaymentIntentIds = new Set(
      (subscriptionReceipts as any[])
        .filter(
          (receipt) =>
            isSubscriptionProration(receipt) &&
            SUCCESSFUL_RECEIPT_STATUSES.has(receipt.status) &&
            receipt.processor?.name === 'stripe'
        )
        .map((receipt) => receipt.processor?.transactionId)
        .filter((transactionId): transactionId is string => Boolean(transactionId && transactionId !== 'N/A'))
    );

    const stripeResult = await this.stripeReconciliation.reconcilePeriod(
      currentMonthStart,
      nextMonthStart,
      stripePaymentIntentIds,
      prorationPaymentIntentIds
    );
    const stripeSummary = stripeResult.summary;

    const failedReceipts = (subscriptionReceipts as any[]).filter((receipt) => receipt.status === 'failed');
    const failedAmount = failedReceipts.reduce((sum, receipt) => sum + this.asMoney(receipt.amount), 0);

    const projectionBreakdown = this.emptyBreakdown();
    let atRiskAmount = 0;
    let atRiskSubscriptions = 0;

    for (const billing of projectedBillings as any[]) {
      const projected = this.getScheduledBillingAmount(billing, billing.nextBillingDate);
      this.addToBreakdown(projectionBreakdown, projected.cycle, projected.amount);

      if (!billing.vaulted || billing.needsUpdate) {
        atRiskAmount += projected.amount;
        atRiskSubscriptions += 1;
      }
    }

    let normalizedMrr = 0;
    let activeMonthlySubscriptions = 0;
    let activeYearlySubscriptions = 0;

    for (const billing of activeBillings as any[]) {
      const cycle = this.toBillingCycle(billing.isYearly ? 'yearly' : 'monthly');
      const cycleAmount = calculatePlanCycleAmount(billing.plan, cycle === 'yearly');
      if (cycleAmount <= 0) continue;

      if (cycle === 'yearly') {
        normalizedMrr += cycleAmount / 12;
        activeYearlySubscriptions += 1;
      } else {
        normalizedMrr += cycleAmount;
        activeMonthlySubscriptions += 1;
      }
    }

    const expectedAmount = this.breakdownTotal(expectedBreakdown);
    const projectedAmount = this.breakdownTotal(projectionBreakdown);

    return {
      generatedAt: now.toISOString(),
      timezone: 'UTC',
      currency: 'USD',
      currentMonth: {
        period: this.period(currentMonthStart, nextMonthStart),
        expected: {
          amount: this.asMoney(expectedAmount),
          subscriptions: expectedSubscriptionIds.size,
          breakdown: expectedBreakdown,
          proratedSubscriptionCharges: {
            amount: this.asMoney(this.breakdownTotal(prorationBreakdown)),
            charges: proratedObligations.size,
            breakdown: prorationBreakdown,
          },
          source: 'Local subscription receipts plus billing accounts still scheduled in the period',
        },
        actual: {
          ...stripeSummary,
          source: 'Stripe charges matched to local subscription receipts',
        },
        variance: {
          gross: this.asMoney(stripeSummary.grossCaptured - expectedAmount),
          net: this.asMoney(stripeSummary.netReceived - expectedAmount),
        },
        failedPayments: {
          count: failedReceipts.length,
          amount: this.asMoney(failedAmount),
          stripeFailedChargeAttempts: stripeSummary.failedChargeAttempts,
          source: 'Local subscription receipts; Stripe charge failures are shown separately for reconciliation',
        },
      },
      nextMonthProjection: {
        period: this.period(nextMonthStart, followingMonthStart),
        scheduledCashCollections: {
          amount: this.asMoney(projectedAmount),
          subscriptions: (projectedBillings as any[]).length,
          breakdown: projectionBreakdown,
        },
        collectionRisk: {
          amount: this.asMoney(atRiskAmount),
          subscriptions: atRiskSubscriptions,
          reason: 'Subscription has no vaulted payment method or is marked as needing a payment update',
        },
        normalizedMonthlyRecurringRevenue: {
          amount: this.asMoney(normalizedMrr),
          activeSubscriptions: activeMonthlySubscriptions + activeYearlySubscriptions,
          monthlySubscriptions: activeMonthlySubscriptions,
          yearlySubscriptions: activeYearlySubscriptions,
          explanation: 'Annual plan cycle amounts are divided by 12; scheduled cash collections include the full annual charge only when it renews next month',
        },
      },
    };
  }

  private findScheduledBillings(start: Date, end: Date) {
    return BillingAccount.find({
      nextBillingDate: { $gte: start, $lt: end },
      status: { $in: ['active', 'trialing'] },
      pendingCancellation: { $ne: true },
      plan: { $exists: true, $ne: null },
    })
      .populate('plan')
      .populate('scheduledPlanChange.plan')
      .lean();
  }

  private getScheduledBillingAmount(billing: any, billingDate: Date): { amount: number; cycle: BillingCycle } {
    const scheduledChange = billing.scheduledPlanChange;
    const useScheduledChange =
      scheduledChange?.plan &&
      scheduledChange.effectiveDate &&
      new Date(scheduledChange.effectiveDate).getTime() <= new Date(billingDate).getTime();

    const plan = useScheduledChange ? scheduledChange.plan : billing.plan;
    const isYearly = useScheduledChange ? Boolean(scheduledChange.isYearly) : Boolean(billing.isYearly);
    const cycleAmount = calculatePlanCycleAmount(plan, isYearly);
    const credits = Number(billing.credits ?? 0);
    const amount = Math.max(0, cycleAmount - (Number.isFinite(credits) ? credits : 0));

    return {
      amount: this.asMoney(amount),
      cycle: isYearly ? 'yearly' : 'monthly',
    };
  }

  private emptyBreakdown(): RevenueBreakdown {
    return {
      monthly: { amount: 0, subscriptions: 0 },
      yearly: { amount: 0, subscriptions: 0 },
    };
  }

  private addToBreakdown(breakdown: RevenueBreakdown, cycle: BillingCycle, amount: number) {
    breakdown[cycle].amount = this.asMoney(breakdown[cycle].amount + amount);
    breakdown[cycle].subscriptions += 1;
  }

  private breakdownTotal(breakdown: RevenueBreakdown): number {
    return breakdown.monthly.amount + breakdown.yearly.amount;
  }

  private toBillingCycle(value: unknown): BillingCycle {
    return value === 'yearly' ? 'yearly' : 'monthly';
  }

  private startOfUtcMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private addUtcMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  }

  private period(start: Date, end: Date) {
    return { start: start.toISOString(), endExclusive: end.toISOString() };
  }

  private asMoney(amount: number): number {
    return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  }
}
