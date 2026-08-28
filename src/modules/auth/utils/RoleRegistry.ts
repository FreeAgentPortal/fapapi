// utils/RoleRegistry.ts

export type BillingRenewalAnchor =
  | { type: 'rolling-days'; days: number }
  | { type: 'rolling-years'; years: number }
  | { type: 'calendar-month'; day: number };

export type SubscriptionStartPolicy = {
  chargeTiming: 'immediate' | 'deferred';
  amount: 'full' | 'prorated';
  renewalAnchor: {
    monthly: BillingRenewalAnchor;
    yearly: BillingRenewalAnchor;
  };
};

export type RoleMetadata = {
  isBillable: boolean;
  billingScope: 'profile' | 'shared' | 'none';
  displayName: string;
  trial?: boolean;
  setupFeeAmountCents?: number;
  // boolean to indicate whether or not the role should pay the setup fee
  requiresSetupFee?: boolean;
  trialLength?: number; // in days
  subscriptionStart?: SubscriptionStartPolicy;
};

const deferredCalendarBilling: SubscriptionStartPolicy = {
  chargeTiming: 'deferred',
  amount: 'full',
  renewalAnchor: {
    monthly: { type: 'calendar-month', day: 1 },
    yearly: { type: 'calendar-month', day: 1 },
  },
};

export const RoleRegistry: Record<string, RoleMetadata> = {
  team: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Team',
    trial: true,
    trialLength: 0,
    requiresSetupFee: false,
    subscriptionStart: deferredCalendarBilling,
  },
  athlete: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Athlete',
    trial: true,
    trialLength: 0,
    requiresSetupFee: true,
    setupFeeAmountCents: 0, // $0 — creates a receipt; set to e.g. 5000 to charge $50
    subscriptionStart: {
      ...deferredCalendarBilling,
      amount: 'prorated',
    },
  },
  professional: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Front Office Professional',
    trial: true,
    trialLength: 0,
    requiresSetupFee: false,
    subscriptionStart: {
      chargeTiming: 'immediate',
      amount: 'full',
      renewalAnchor: {
        monthly: { type: 'rolling-days', days: 30 },
        yearly: { type: 'rolling-years', years: 1 },
      },
    },
  },
  agent: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Agent',
    trial: true,
    trialLength: 0,
    requiresSetupFee: false,
    subscriptionStart: deferredCalendarBilling,
  },
  admin: {
    isBillable: false,
    billingScope: 'none',
    displayName: 'Admin',
    requiresSetupFee: false,
  },
  // add others as needed
};
