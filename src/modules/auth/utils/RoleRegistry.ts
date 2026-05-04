// utils/RoleRegistry.ts

export type RoleMetadata = {
  isBillable: boolean;
  billingScope: 'profile' | 'shared' | 'none';
  displayName: string;
  trial?: boolean;
  trialLength?: number; // in days
};

export const RoleRegistry: Record<string, RoleMetadata> = {
  team: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Team',
    trial: true,
    trialLength: 0,
  },
  athlete: {
    isBillable: true,
    billingScope: 'profile',
    displayName: 'Athlete',
    trial: true,
    trialLength: 0,
  },
  admin: {
    isBillable: false,
    billingScope: 'none',
    displayName: 'Admin',
  },
  // add others as needed
};
