import { calculatePlanCycleAmount } from './billingPlanUtils';

export type ProjectionBillingCycle = 'monthly' | 'yearly';

export type ProjectionPlan = {
  _id?: unknown;
  id?: string;
  name: string;
  price: number | string;
  yearlyDiscount?: number;
};

export type ProjectionBillingAccount = {
  _id: unknown;
  profileType: string;
  status: string;
  plan?: ProjectionPlan | null;
  isYearly?: boolean;
  nextBillingDate?: Date | string | null;
  credits?: number;
  vaulted?: boolean;
  needsUpdate?: boolean;
  pendingCancellation?: boolean;
  scheduledPlanChange?: {
    plan?: ProjectionPlan | null;
    effectiveDate?: Date | string | null;
    isYearly?: boolean;
  } | null;
};

export type ResolvedAcquisition = {
  profileType: 'athlete' | 'agent' | 'professional';
  planId: string;
  planName: string;
  planPrice: number;
  yearlyDiscount: number;
  billingCycle: ProjectionBillingCycle;
  newSubscribersPerMonth: number;
};

type ProjectionMonth = {
  month: string;
  contracted: number;
  collectible: number;
  atRisk: number;
  charges: number;
};

type ScenarioMonth = {
  month: string;
  newSubscribers: number;
  collections: number;
  breakdown: Array<{
    profileType: ResolvedAcquisition['profileType'];
    planId: string;
    planName: string;
    billingCycle: ProjectionBillingCycle;
    newSubscribers: number;
    collections: number;
  }>;
};

type ProjectionBreakdownItem = {
  profileType: string;
  planId: string;
  planName: string;
  billingCycle: ProjectionBillingCycle;
  contracted: number;
  collectible: number;
  atRisk: number;
  charges: number;
};

export function projectExistingSubscriptions(
  billingAccounts: ProjectionBillingAccount[],
  now: Date,
  endExclusive: Date
) {
  const year = now.getUTCFullYear();
  const timeline = buildProjectionTimeline(year);
  const breakdown = new Map<string, ProjectionBreakdownItem>();
  const excluded = {
    suspended: 0,
    inactive: 0,
    pendingCancellation: 0,
    missingPlan: 0,
    missingBillingDate: 0,
  };
  let contracted = 0;
  let collectible = 0;
  let atRisk = 0;
  let charges = 0;
  let contractedMrr = 0;
  let collectibleMrr = 0;
  let atRiskMrr = 0;
  let activeSubscriptions = 0;

  for (const billing of billingAccounts) {
    if (billing.status === 'suspended') {
      excluded.suspended += 1;
      continue;
    }
    if (billing.status === 'inactive') {
      excluded.inactive += 1;
      continue;
    }
    if (!['active', 'trialing'].includes(billing.status)) continue;
    if (billing.pendingCancellation) {
      excluded.pendingCancellation += 1;
      continue;
    }
    if (!billing.plan) {
      excluded.missingPlan += 1;
      continue;
    }

    activeSubscriptions += 1;
    const currentlyCollectible = Boolean(billing.vaulted) && !billing.needsUpdate;
    const currentPlanState = resolvePlanState(billing, now);
    const currentCycleAmount = calculatePlanCycleAmount(
      currentPlanState.plan,
      currentPlanState.billingCycle === 'yearly'
    );
    const currentMrr = currentPlanState.billingCycle === 'yearly'
      ? currentCycleAmount / 12
      : currentCycleAmount;
    contractedMrr += currentMrr;
    if (currentlyCollectible) collectibleMrr += currentMrr;
    else atRiskMrr += currentMrr;

    const parsedNextBillingDate = parseDate(billing.nextBillingDate);
    if (!parsedNextBillingDate) {
      excluded.missingBillingDate += 1;
      continue;
    }

    let dueDate = parsedNextBillingDate.getTime() <= now.getTime() ? new Date(now) : parsedNextBillingDate;
    let firstCharge = true;
    let safetyCounter = 0;

    while (dueDate.getTime() < endExclusive.getTime() && safetyCounter < 24) {
      safetyCounter += 1;
      const planState = resolvePlanState(billing, dueDate);
      const fullCycleAmount = calculatePlanCycleAmount(
        planState.plan,
        planState.billingCycle === 'yearly'
      );
      const credit = firstCharge ? Math.max(0, Number(billing.credits ?? 0)) : 0;
      const amount = money(Math.max(0, fullCycleAmount - credit));
      firstCharge = false;

      if (amount > 0) {
        contracted += amount;
        charges += 1;
        if (currentlyCollectible) collectible += amount;
        else atRisk += amount;

        const month = timeline[dueDate.getUTCMonth()];
        month.contracted += amount;
        month.charges += 1;
        if (currentlyCollectible) month.collectible += amount;
        else month.atRisk += amount;

        const planId = getPlanId(planState.plan);
        const key = `${billing.profileType}:${planId}:${planState.billingCycle}`;
        const item = breakdown.get(key) ?? {
          profileType: billing.profileType,
          planId,
          planName: planState.plan.name,
          billingCycle: planState.billingCycle,
          contracted: 0,
          collectible: 0,
          atRisk: 0,
          charges: 0,
        };
        item.contracted += amount;
        item.charges += 1;
        if (currentlyCollectible) item.collectible += amount;
        else item.atRisk += amount;
        breakdown.set(key, item);
      }

      dueDate = planState.billingCycle === 'yearly'
        ? new Date(Date.UTC(dueDate.getUTCFullYear() + 1, dueDate.getUTCMonth(), 1))
        : new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 1));
    }
  }

  return {
    totals: {
      contracted: money(contracted),
      collectible: money(collectible),
      atRisk: money(atRisk),
      charges,
    },
    runRate: {
      activeSubscriptions,
      contractedMrr: money(contractedMrr),
      contractedArr: money(contractedMrr * 12),
      collectibleMrr: money(collectibleMrr),
      collectibleArr: money(collectibleMrr * 12),
      atRiskMrr: money(atRiskMrr),
      atRiskArr: money(atRiskMrr * 12),
    },
    excluded,
    timeline: timeline.map(roundProjectionMonth),
    breakdown: Array.from(breakdown.values()).map((item) => ({
      ...item,
      contracted: money(item.contracted),
      collectible: money(item.collectible),
      atRisk: money(item.atRisk),
    })),
  };
}

export function projectAcquisitionScenario(
  acquisitions: ResolvedAcquisition[],
  now: Date,
  endExclusive: Date
) {
  const year = now.getUTCFullYear();
  const timeline = buildScenarioTimeline(year);
  const signupStart = new Date(Date.UTC(year, now.getUTCMonth(), 1));
  const breakdown = [] as Array<ResolvedAcquisition & {
    acquiredSubscribers: number;
    currentYearCollections: number;
    exitMrr: number;
    exitArr: number;
  }>;
  let addedCollections = 0;
  let acquiredSubscribers = 0;
  let exitMrr = 0;

  for (const acquisition of acquisitions) {
    const cycleAmount = calculatePlanCycleAmount(
      {
        price: acquisition.planPrice,
        yearlyDiscount: acquisition.yearlyDiscount,
      },
      acquisition.billingCycle === 'yearly'
    );
    let rowSubscribers = 0;
    let rowCollections = 0;
    let signupMonth = new Date(signupStart);

    for (const month of timeline) {
      month.breakdown.push({
        profileType: acquisition.profileType,
        planId: acquisition.planId,
        planName: acquisition.planName,
        billingCycle: acquisition.billingCycle,
        newSubscribers: 0,
        collections: 0,
      });
    }

    while (signupMonth.getTime() < endExclusive.getTime()) {
      const cohortSize = acquisition.newSubscribersPerMonth;
      rowSubscribers += cohortSize;
      acquiredSubscribers += cohortSize;
      timeline[signupMonth.getUTCMonth()].newSubscribers += cohortSize;
      timeline[signupMonth.getUTCMonth()].breakdown.find(
        (item) => item.profileType === acquisition.profileType &&
          item.planId === acquisition.planId &&
          item.billingCycle === acquisition.billingCycle
      )!.newSubscribers += cohortSize;

      let chargeMonth = new Date(Date.UTC(
        signupMonth.getUTCFullYear(),
        signupMonth.getUTCMonth() + 1,
        1
      ));
      if (acquisition.billingCycle === 'yearly') {
        if (chargeMonth.getTime() < endExclusive.getTime()) {
          const amount = cycleAmount * cohortSize;
          rowCollections += amount;
          addedCollections += amount;
          timeline[chargeMonth.getUTCMonth()].collections += amount;
          timeline[chargeMonth.getUTCMonth()].breakdown.find(
            (item) => item.profileType === acquisition.profileType &&
              item.planId === acquisition.planId &&
              item.billingCycle === acquisition.billingCycle
          )!.collections += amount;
        }
      } else {
        while (chargeMonth.getTime() < endExclusive.getTime()) {
          const amount = cycleAmount * cohortSize;
          rowCollections += amount;
          addedCollections += amount;
          timeline[chargeMonth.getUTCMonth()].collections += amount;
          timeline[chargeMonth.getUTCMonth()].breakdown.find(
            (item) => item.profileType === acquisition.profileType &&
              item.planId === acquisition.planId &&
              item.billingCycle === acquisition.billingCycle
          )!.collections += amount;
          chargeMonth = new Date(Date.UTC(
            chargeMonth.getUTCFullYear(),
            chargeMonth.getUTCMonth() + 1,
            1
          ));
        }
      }

      signupMonth = new Date(Date.UTC(
        signupMonth.getUTCFullYear(),
        signupMonth.getUTCMonth() + 1,
        1
      ));
    }

    const rowMrr = (acquisition.billingCycle === 'yearly' ? cycleAmount / 12 : cycleAmount) * rowSubscribers;
    exitMrr += rowMrr;
    breakdown.push({
      ...acquisition,
      acquiredSubscribers: rowSubscribers,
      currentYearCollections: money(rowCollections),
      exitMrr: money(rowMrr),
      exitArr: money(rowMrr * 12),
    });
  }

  return {
    totals: {
      addedCurrentYearCollections: money(addedCollections),
      acquiredSubscribers,
      exitMrr: money(exitMrr),
      exitArr: money(exitMrr * 12),
    },
    timeline: timeline.map((month) => ({
      ...month,
      collections: money(month.collections),
      breakdown: month.breakdown.map((item) => ({
        ...item,
        collections: money(item.collections),
      })),
    })),
    breakdown,
  };
}

function resolvePlanState(
  billing: ProjectionBillingAccount,
  at: Date
): { plan: ProjectionPlan; billingCycle: ProjectionBillingCycle } {
  const scheduled = billing.scheduledPlanChange;
  const effectiveDate = parseDate(scheduled?.effectiveDate);
  if (scheduled?.plan && effectiveDate && effectiveDate.getTime() <= at.getTime()) {
    return {
      plan: scheduled.plan,
      billingCycle: scheduled.isYearly ? 'yearly' : 'monthly',
    };
  }
  return {
    plan: billing.plan as ProjectionPlan,
    billingCycle: billing.isYearly ? 'yearly' : 'monthly',
  };
}

function buildProjectionTimeline(year: number): ProjectionMonth[] {
  return Array.from({ length: 12 }, (_, monthIndex) => ({
    month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    contracted: 0,
    collectible: 0,
    atRisk: 0,
    charges: 0,
  }));
}

function buildScenarioTimeline(year: number): ScenarioMonth[] {
  return Array.from({ length: 12 }, (_, monthIndex) => ({
    month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    newSubscribers: 0,
    collections: 0,
    breakdown: [],
  }));
}

function roundProjectionMonth(month: ProjectionMonth): ProjectionMonth {
  return {
    ...month,
    contracted: money(month.contracted),
    collectible: money(month.collectible),
    atRisk: money(month.atRisk),
  };
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPlanId(plan: ProjectionPlan): string {
  return String(plan._id ?? plan.id ?? 'unknown-plan');
}

function money(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}
