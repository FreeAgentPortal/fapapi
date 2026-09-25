import { PlanEntitlements } from '../../auth/model/PlanSchema';
import type { BillingRenewalAnchor, SubscriptionStartPolicy } from '../../auth/utils/RoleRegistry';
import moment from 'moment';

export type BillingPlanChangeType = 'upgrade' | 'downgrade' | 'lateral';

export type BillingPlanSnapshot = {
  plan: any;
  features: any[];
  entitlements: PlanEntitlements;
  isYearly: boolean;
};

export type ScheduledBillingPlanChange = BillingPlanSnapshot & {
  effectiveDate: Date;
  changeType: BillingPlanChangeType;
};

export function buildBillingPlanSnapshot(plan: any, entitlements: PlanEntitlements, isYearly: boolean): BillingPlanSnapshot {
  return {
    plan: normalizeReference(plan?._id ?? plan),
    features: normalizeFeatures(plan?.features),
    entitlements: {
      agentSeats: entitlements?.agentSeats ?? null,
      teamInterestsPerMonth: entitlements?.teamInterestsPerMonth ?? null,
    },
    isYearly,
  };
}

export function applyBillingPlanSnapshot(billing: any, snapshot: BillingPlanSnapshot): void {
  billing.plan = normalizeReference(snapshot.plan);
  billing.features = normalizeFeatures(snapshot.features);
  billing.entitlements = {
    agentSeats: snapshot.entitlements?.agentSeats ?? null,
    teamInterestsPerMonth: snapshot.entitlements?.teamInterestsPerMonth ?? null,
  };
  billing.isYearly = Boolean(snapshot.isYearly);
}

export function calculatePlanCycleAmount(plan: any, isYearly: boolean): number {
  const baseMonthlyAmount = Number(plan?.price ?? 0);
  if (!Number.isFinite(baseMonthlyAmount) || baseMonthlyAmount <= 0) {
    return 0;
  }

  if (!isYearly) {
    return baseMonthlyAmount;
  }

  const configuredDiscount = Number(plan?.yearlyDiscount ?? 0);
  const yearlyDiscountPercent = configuredDiscount > 0 && configuredDiscount < 1 ? configuredDiscount * 100 : configuredDiscount;
  return baseMonthlyAmount * 12 * (1 - yearlyDiscountPercent / 100);
}

export function calculateInitialBillingDate(policy: SubscriptionStartPolicy, isYearly: boolean, activationDate: Date = new Date()): Date {
  const anchor = policy.renewalAnchor[isYearly ? 'yearly' : 'monthly'];
  return applyRenewalAnchor(anchor, activationDate);
}

export function calculateNextRenewalBillingDate(
  policy: SubscriptionStartPolicy,
  isYearly: boolean,
  currentBillingDate: Date,
  processedAt: Date = new Date()
): Date {
  const processedMoment = moment(processedAt);
  let nextBillingMoment = moment(currentBillingDate);

  if (!nextBillingMoment.isValid()) {
    nextBillingMoment = processedMoment.clone();
  }

  const advanceOneCycle = (billingMoment: moment.Moment): moment.Moment => {
    if (isYearly) {
      return billingMoment.clone().add(1, 'year');
    }

    return moment(applyRenewalAnchor(policy.renewalAnchor.monthly, billingMoment.toDate()));
  };

  nextBillingMoment = advanceOneCycle(nextBillingMoment);

  // Preserve the stored billing anchor while ensuring an overdue account cannot
  // remain due immediately after a successful renewal payment.
  while (!nextBillingMoment.isAfter(processedMoment)) {
    nextBillingMoment = advanceOneCycle(nextBillingMoment);
  }

  return nextBillingMoment.toDate();
}

export function calculateInitialSubscriptionChargeInCents(
  plan: any,
  isYearly: boolean,
  policy: SubscriptionStartPolicy,
  activationDate: Date,
  nextBillingDate: Date
): number {
  const fullCycleAmountInCents = Math.round(calculatePlanCycleAmount(plan, isYearly) * 100);
  if (policy.amount === 'full') {
    return fullCycleAmountInCents;
  }

  const cycleEnd = moment(nextBillingDate);
  const cycleStart = moment(nextBillingDate).subtract(1, isYearly ? 'year' : 'month');
  const totalCycleMs = Math.max(cycleEnd.diff(cycleStart), 1);
  const remainingCycleMs = Math.max(cycleEnd.diff(moment(activationDate)), 0);
  const remainingRatio = Math.min(1, remainingCycleMs / totalCycleMs);

  return Math.round(fullCycleAmountInCents * remainingRatio);
}

function applyRenewalAnchor(anchor: BillingRenewalAnchor, activationDate: Date): Date {
  if (anchor.type === 'rolling-days') {
    return moment(activationDate).add(anchor.days, 'days').toDate();
  }

  if (anchor.type === 'rolling-years') {
    return moment(activationDate).add(anchor.years, 'years').toDate();
  }

  const nextMonth = moment(activationDate).add(1, 'month').startOf('month');
  return nextMonth.date(Math.min(Math.max(anchor.day, 1), nextMonth.daysInMonth())).toDate();
}

function normalizeFeatures(features: any): any[] {
  if (!Array.isArray(features)) {
    return [];
  }

  return features
    .map((feature) => normalizeReference(feature))
    .filter((feature): feature is any => Boolean(feature));
}

function normalizeReference(candidate: any): any {
  if (!candidate) {
    return candidate;
  }

  return candidate?._id ?? candidate;
}
