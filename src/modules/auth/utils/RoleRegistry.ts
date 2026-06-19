// utils/RoleRegistry.ts

export type RoleMetadata = {
  isBillable: boolean;
  billingScope: 'profile' | 'shared' | 'none';
  displayName: string;
  trial?: boolean;
  setupFeeAmount?: number; // one-time fee in cents
  // boolean to indicate whether or not the role should pay the setup fee
  requiresSetupFee?: boolean;
  trialLength?: number; // in days
};

export const RoleRegistry: Record<string, RoleMetadata> = {
  team: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Team',
    trial: true,
    trialLength: 0,
    requiresSetupFee: false,
  },
  athlete: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Athlete',
    trial: true,
    trialLength: 0,
    requiresSetupFee: true,
    setupFeeAmount: 5000, // $50 one-time fee, in cents
  },
  professional: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Front Office Professional',
    trial: true,
    trialLength: 0,
    requiresSetupFee: false,
  },
  agent: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Agent',
    trial: true,
    trialLength: 0,
    requiresSetupFee: false,
  },
  admin: {
    isBillable: false,
    billingScope: 'none',
    displayName: 'Admin',
    requiresSetupFee: false,
  },
  // add others as needed
};
