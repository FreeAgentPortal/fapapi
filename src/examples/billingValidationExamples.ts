/**
 * Example usage of the BillingValidator utility
 * This file demonstrates various ways to use the billing validation functionality
 */

import { BillingValidator } from '../utils/billingValidation';
import BillingAccount, { BillingAccountType } from '../modules/auth/model/BillingAccount';

// Example 1: Simple boolean check
export const exampleSimpleCheck = async (profileId: string): Promise<boolean> => {
  const billing = await BillingAccount.findOne({ profileId });
  return BillingValidator.needsBillingUpdate(billing);
};

// Example 2: Comprehensive validation with detailed results
export const exampleDetailedValidation = async (profileId: string) => {
  const billing = await BillingAccount.findOne({ profileId });
  const validation = BillingValidator.validateBillingAccount(billing);

  return {
    needsUpdate: validation.needsUpdate,
    userMessage: BillingValidator.getBillingStatusMessage(billing),
    details: validation,
    isPaymentSaved: BillingValidator.isPaymentMethodSaved(billing),
    isInGoodStanding: BillingValidator.isAccountInGoodStanding(billing),
  };
};

// Example 3: API endpoint response helper
export const getBillingStatusForAPI = async (profileId: string) => {
  const billing = await BillingAccount.findOne({ profileId });
  const validation = BillingValidator.validateBillingAccount(billing);

  return {
    status: validation.needsUpdate ? 'needs_update' : 'current',
    severity: validation.severity,
    message: BillingValidator.getBillingStatusMessage(billing),
    actions_required: validation.recommendations,
    payment_method_saved: BillingValidator.isPaymentMethodSaved(billing),
  };
};

// Example 4: Middleware helper for routes that require valid billing
export const requireValidBilling = async (profileId: string): Promise<void> => {
  const billing = await BillingAccount.findOne({ profileId });

  if (!BillingValidator.isAccountInGoodStanding(billing)) {
    const validation = BillingValidator.validateBillingAccount(billing);
    throw new Error(`Billing update required: ${validation.reasons.join(', ')}`);
  }
};

// Example 5: Bulk validation for admin dashboard
export const validateMultipleBillingAccounts = async (profileIds: string[]) => {
  const results = [];

  for (const profileId of profileIds) {
    const billing = await BillingAccount.findOne({ profileId });
    const validation = BillingValidator.validateBillingAccount(billing);

    results.push({
      profileId,
      needsUpdate: validation.needsUpdate,
      severity: validation.severity,
      issues: validation.reasons.length,
      status: billing?.status || 'unknown',
    });
  }

  return results;
};
