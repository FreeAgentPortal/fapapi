import mongoose from 'mongoose';
import Stripe from 'stripe';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import BillingAccount from '../../auth/model/BillingAccount';
import PlanSchema from '../../auth/model/PlanSchema';
import { StripeSubscriptionReconciliation } from '../classes/StripeSubscriptionReconciliation';
import Receipt from '../models/Receipt';
import { buildSubscriptionReceiptQuery, isSubscriptionProration } from '../utils/subscriptionRevenue';
import {
  projectAcquisitionScenario,
  projectExistingSubscriptions,
  type ResolvedAcquisition,
} from '../utils/yearlyRevenueProjection';

type AcquisitionInput = {
  profileType?: unknown;
  planId?: unknown;
  billingCycle?: unknown;
  newSubscribersPerMonth?: unknown;
};

const SUCCESSFUL_RECEIPT_STATUSES = new Set(['success', 'succeeded', 'completed']);
const SUPPORTED_PROFILE_TYPES = new Set(['athlete', 'agent', 'professional']);

export class YearlySubscriptionRevenueHandler {
  private readonly stripeReconciliation: StripeSubscriptionReconciliation;

  constructor(stripe?: Stripe) {
    this.stripeReconciliation = new StripeSubscriptionReconciliation(stripe);
  }

  public async generateBaseline(now: Date = new Date()) {
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

    const [subscriptionReceipts, billingAccounts] = await Promise.all([
      Receipt.find(buildSubscriptionReceiptQuery(yearStart, now))
        .select(
          'billingAccountId amount currency status planInfo processor transactionDate description revenueCategory reconciliation'
        )
        .sort({ transactionDate: 1 })
        .lean(),
      BillingAccount.find({})
        .select(
          '_id profileType status plan isYearly nextBillingDate credits vaulted needsUpdate pendingCancellation scheduledPlanChange'
        )
        .populate('plan')
        .populate('scheduledPlanChange.plan')
        .lean(),
    ]);

    const successfulStripeReceipts = (subscriptionReceipts as any[]).filter(
      (receipt) => SUCCESSFUL_RECEIPT_STATUSES.has(receipt.status) && receipt.processor?.name === 'stripe'
    );
    const subscriptionTransactionIds = new Set(
      successfulStripeReceipts
        .map((receipt) => receipt.processor?.transactionId)
        .filter((id): id is string => Boolean(id && id !== 'N/A' && id !== 'ERROR'))
    );
    const prorationTransactionIds = new Set(
      successfulStripeReceipts
        .filter((receipt) => isSubscriptionProration(receipt))
        .map((receipt) => receipt.processor?.transactionId)
        .filter((id): id is string => Boolean(id && id !== 'N/A' && id !== 'ERROR'))
    );

    const stripeResult = await this.stripeReconciliation.reconcilePeriod(
      yearStart,
      now,
      subscriptionTransactionIds,
      prorationTransactionIds
    );
    const projection = projectExistingSubscriptions(billingAccounts as any[], now, yearEnd);
    const receiptByTransactionId = new Map<string, any>();
    for (const receipt of successfulStripeReceipts) {
      receiptByTransactionId.set(receipt.processor.transactionId, receipt);
    }
    const billingById = new Map((billingAccounts as any[]).map((billing) => [String(billing._id), billing]));
    const collectedBreakdown = new Map<string, any>();
    const timeline = this.buildTimeline(now.getUTCFullYear());

    for (const charge of stripeResult.matchedCharges) {
      const paymentIntentId = this.resourceId(charge.payment_intent);
      const receipt = receiptByTransactionId.get(paymentIntentId ?? '') ?? receiptByTransactionId.get(charge.id);
      const billing = receipt?.billingAccountId
        ? billingById.get(String(receipt.billingAccountId))
        : undefined;
      const profileType = billing?.profileType ?? 'unknown';
      const planId = receipt?.planInfo?.planId ? String(receipt.planInfo.planId) : 'unknown-plan';
      const planName = receipt?.planInfo?.planName ?? 'Unknown plan';
      const billingCycle = receipt?.planInfo?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
      const prorated = receipt ? isSubscriptionProration(receipt) : false;
      const amount = this.centsToMoney(charge.amount_captured);
      const key = `${profileType}:${planId}:${billingCycle}`;
      const item = collectedBreakdown.get(key) ?? {
        profileType,
        planId,
        planName,
        billingCycle,
        grossCaptured: 0,
        recurringGrossCaptured: 0,
        proratedGrossCaptured: 0,
        payments: 0,
      };
      item.grossCaptured += amount;
      item.payments += 1;
      if (prorated) item.proratedGrossCaptured += amount;
      else item.recurringGrossCaptured += amount;
      collectedBreakdown.set(key, item);

      const month = timeline[new Date(charge.created * 1000).getUTCMonth()];
      month.actualGrossCaptured += amount;
      if (prorated) month.actualProratedGrossCaptured += amount;
    }
    for (const refund of stripeResult.matchedRefunds) {
      timeline[new Date(refund.created * 1000).getUTCMonth()].actualRefunds += this.centsToMoney(refund.amount);
    }
    for (const projectedMonth of projection.timeline) {
      const monthIndex = Number(projectedMonth.month.slice(5, 7)) - 1;
      Object.assign(timeline[monthIndex], {
        projectedContracted: projectedMonth.contracted,
        projectedCollectible: projectedMonth.collectible,
        projectedAtRisk: projectedMonth.atRisk,
        projectedCharges: projectedMonth.charges,
      });
    }

    const summary = stripeResult.summary;
    const projectedContractedGross = this.money(summary.grossCaptured + projection.totals.contracted);
    const projectedCollectibleGross = this.money(summary.grossCaptured + projection.totals.collectible);

    return {
      generatedAt: now.toISOString(),
      timezone: 'UTC',
      currency: 'USD',
      period: {
        year: now.getUTCFullYear(),
        start: yearStart.toISOString(),
        asOf: now.toISOString(),
        endExclusive: yearEnd.toISOString(),
      },
      headline: {
        collectedGrossYtd: summary.grossCaptured,
        collectedNetYtd: summary.netReceived,
        projectedFullYearGrossIfCurrentSubscriptionsHold: projectedContractedGross,
        projectedCollectibleFullYearGross: projectedCollectibleGross,
      },
      collectedYtd: {
        ...summary,
        recurringGrossCaptured: this.money(summary.grossCaptured - summary.proratedGrossCaptured),
        breakdown: Array.from(collectedBreakdown.values()).map((item) => ({
          ...item,
          grossCaptured: this.money(item.grossCaptured),
          recurringGrossCaptured: this.money(item.recurringGrossCaptured),
          proratedGrossCaptured: this.money(item.proratedGrossCaptured),
        })),
        source: 'Stripe charges matched to local subscription and subscription-proration receipts',
      },
      remainingYearProjection: {
        ...projection.totals,
        breakdown: projection.breakdown,
        assumptions: [
          'No churn, new baseline subscribers, upgrades, downgrades, or future prorations',
          'Pending cancellations, suspended accounts, and inactive accounts do not renew',
          'At-risk subscriptions are included in contracted revenue and excluded from collectible revenue',
        ],
      },
      projectedFullYear: {
        contractedGross: projectedContractedGross,
        collectibleGross: projectedCollectibleGross,
        atRiskGross: projection.totals.atRisk,
      },
      currentRunRate: projection.runRate,
      excludedSubscriptions: projection.excluded,
      timeline: timeline.map((month) => ({
        ...month,
        actualGrossCaptured: this.money(month.actualGrossCaptured),
        actualProratedGrossCaptured: this.money(month.actualProratedGrossCaptured),
        actualRefunds: this.money(month.actualRefunds),
      })),
    };
  }

  public async generateScenario(acquisitions: AcquisitionInput[], now: Date = new Date()) {
    const resolvedAcquisitions = await this.resolveAcquisitions(acquisitions);
    const baseline = await this.generateBaseline(now);
    const endExclusive = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    const scenarioProjection = projectAcquisitionScenario(resolvedAcquisitions, now, endExclusive);
    const added = scenarioProjection.totals.addedCurrentYearCollections;

    return {
      generatedAt: now.toISOString(),
      timezone: 'UTC',
      currency: 'USD',
      baseline,
      scenario: {
        assumptions: [
          'The same number of subscribers is acquired each month through December',
          'The first subscription charge occurs in the month after signup',
          'No churn, credits, setup fees, plan changes, or prorations are modeled',
        ],
        resolvedAcquisitions: scenarioProjection.breakdown,
        addedCurrentYearCollections: added,
        projectedFullYear: {
          contractedGross: this.money(baseline.projectedFullYear.contractedGross + added),
          collectibleGross: this.money(baseline.projectedFullYear.collectibleGross + added),
        },
        acquiredCohortRunRate: {
          subscribers: scenarioProjection.totals.acquiredSubscribers,
          exitMrr: scenarioProjection.totals.exitMrr,
          exitArr: scenarioProjection.totals.exitArr,
        },
        combinedYearEndRunRate: {
          contractedMrr: this.money(
            baseline.currentRunRate.contractedMrr + scenarioProjection.totals.exitMrr
          ),
          contractedArr: this.money(
            baseline.currentRunRate.contractedArr + scenarioProjection.totals.exitArr
          ),
          collectibleMrr: this.money(
            baseline.currentRunRate.collectibleMrr + scenarioProjection.totals.exitMrr
          ),
          collectibleArr: this.money(
            baseline.currentRunRate.collectibleArr + scenarioProjection.totals.exitArr
          ),
        },
        timeline: scenarioProjection.timeline.map((scenarioMonth, index) => ({
          ...scenarioMonth,
          baselineActualGrossCaptured: baseline.timeline[index].actualGrossCaptured,
          baselineProjectedContracted: baseline.timeline[index].projectedContracted,
          baselineProjectedCollectible: baseline.timeline[index].projectedCollectible,
          contractedWithGrowth: this.money(
            baseline.timeline[index].projectedContracted + scenarioMonth.collections
          ),
          collectibleWithGrowth: this.money(
            baseline.timeline[index].projectedCollectible + scenarioMonth.collections
          ),
        })),
      },
    };
  }

  private async resolveAcquisitions(acquisitions: AcquisitionInput[]): Promise<ResolvedAcquisition[]> {
    if (!Array.isArray(acquisitions) || acquisitions.length === 0) {
      throw new ErrorUtil('acquisitions must contain at least one scenario row', 400);
    }

    const normalized = acquisitions.map((input, index) => {
      const profileType = String(input?.profileType ?? '');
      const planId = String(input?.planId ?? '');
      const billingCycle = String(input?.billingCycle ?? '');
      const newSubscribersPerMonth = Number(input?.newSubscribersPerMonth);

      if (!SUPPORTED_PROFILE_TYPES.has(profileType)) {
        throw new ErrorUtil(`acquisitions[${index}].profileType is not supported`, 400);
      }
      if (!mongoose.isValidObjectId(planId)) {
        throw new ErrorUtil(`acquisitions[${index}].planId is invalid`, 400);
      }
      if (!['monthly', 'yearly'].includes(billingCycle)) {
        throw new ErrorUtil(`acquisitions[${index}].billingCycle must be monthly or yearly`, 400);
      }
      if (!Number.isInteger(newSubscribersPerMonth) || newSubscribersPerMonth < 0) {
        throw new ErrorUtil(
          `acquisitions[${index}].newSubscribersPerMonth must be a nonnegative integer`,
          400
        );
      }
      return { profileType, planId, billingCycle, newSubscribersPerMonth };
    });

    const uniqueKeys = new Set<string>();
    for (const input of normalized) {
      const key = `${input.profileType}:${input.planId}:${input.billingCycle}`;
      if (uniqueKeys.has(key)) throw new ErrorUtil(`Duplicate acquisition row: ${key}`, 400);
      uniqueKeys.add(key);
    }

    const plans = await PlanSchema.find({ _id: { $in: normalized.map((input) => input.planId) } }).lean();
    const plansById = new Map((plans as any[]).map((plan) => [String(plan._id), plan]));

    return normalized.map((input, index) => {
      const plan = plansById.get(input.planId);
      if (!plan) throw new ErrorUtil(`acquisitions[${index}].planId was not found`, 400);
      if (!plan.isActive) throw new ErrorUtil(`acquisitions[${index}] references an inactive plan`, 400);
      if (!Array.isArray(plan.availableTo) || !plan.availableTo.includes(input.profileType)) {
        throw new ErrorUtil(
          `acquisitions[${index}] plan is not available to ${input.profileType}`,
          400
        );
      }
      const planPrice = Number(plan.price);
      if (!Number.isFinite(planPrice) || planPrice <= 0) {
        throw new ErrorUtil(`acquisitions[${index}] must reference a paid plan`, 400);
      }
      return {
        profileType: input.profileType as ResolvedAcquisition['profileType'],
        planId: input.planId,
        planName: plan.name,
        planPrice,
        yearlyDiscount: Number(plan.yearlyDiscount ?? 0),
        billingCycle: input.billingCycle as ResolvedAcquisition['billingCycle'],
        newSubscribersPerMonth: input.newSubscribersPerMonth,
      };
    });
  }

  private buildTimeline(year: number) {
    return Array.from({ length: 12 }, (_, monthIndex) => ({
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      actualGrossCaptured: 0,
      actualProratedGrossCaptured: 0,
      actualRefunds: 0,
      projectedContracted: 0,
      projectedCollectible: 0,
      projectedAtRisk: 0,
      projectedCharges: 0,
    }));
  }

  private resourceId(resource: string | { id: string } | null): string | null {
    if (!resource) return null;
    return typeof resource === 'string' ? resource : resource.id;
  }

  private centsToMoney(cents: number): number {
    return this.money(cents / 100);
  }

  private money(amount: number): number {
    return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  }
}
