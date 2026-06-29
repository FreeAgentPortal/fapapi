import { PlanEntitlements } from '../../auth/model/PlanSchema';

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
    },
    isYearly,
  };
}

export function applyBillingPlanSnapshot(billing: any, snapshot: BillingPlanSnapshot): void {
  billing.plan = normalizeReference(snapshot.plan);
  billing.features = normalizeFeatures(snapshot.features);
  billing.entitlements = {
    agentSeats: snapshot.entitlements?.agentSeats ?? null,
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

  const yearlyDiscount = Number(plan?.yearlyDiscount ?? 0);
  return baseMonthlyAmount * 12 * (1 - yearlyDiscount / 100);
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
