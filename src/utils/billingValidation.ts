import { BillingAccountType } from '../modules/auth/model/BillingAccount';

/**
 * Result interface for billing validation checks
 */
export interface BillingValidationResult {
  needsUpdate: boolean;
  reasons: string[];
  severity: 'critical' | 'warning' | 'info';
  recommendations: string[];
}

/**
 * Utility class for performing comprehensive billing account validation
 */
export class BillingValidator {
  /**
   * Performs a comprehensive check to determine if billing account needs updates
   * @param billing - The billing account to validate
   * @returns BillingValidationResult with detailed information
   */
  static validateBillingAccount(billing: BillingAccountType | null): BillingValidationResult {
    if (!billing) {
      return {
        needsUpdate: true,
        reasons: ['No billing account found'],
        severity: 'critical',
        recommendations: ['Create a billing account to continue using the service'],
      };
    }

    const reasons: string[] = [];
    const recommendations: string[] = [];
    let severity: 'critical' | 'warning' | 'info' = 'info';

    // Primary check: Payment information not vaulted
    if (!billing.vaulted) {
      reasons.push('Payment information not saved (not vaulted)');
      recommendations.push('Add payment method to vault for automatic billing');
      severity = 'critical';
    }

    // Check if account is inactive or suspended
    if (billing.status === 'inactive' || billing.status === 'suspended') {
      reasons.push(`Account status is ${billing.status}`);
      recommendations.push('Update payment information to reactivate account');
      severity = 'critical';
    }

    // Check if explicitly marked as needing update
    if (billing.needsUpdate) {
      reasons.push('Billing account flagged for manual update');
      recommendations.push('Review and update billing information');
      if (severity !== 'critical') severity = 'warning';
    }

    // Check if next billing date has passed and account is not vaulted
    if (billing.nextBillingDate && billing.nextBillingDate < new Date() && !billing.vaulted) {
      reasons.push('Next billing date has passed without payment method on file');
      recommendations.push('Add payment method before next billing cycle');
      severity = 'critical';
    }

    // Check if trial is ending soon and no payment method
    if (billing.status === 'trialing' && !billing.vaulted) {
      const trialEndDate = new Date(billing.createdAt);
      trialEndDate.setDate(trialEndDate.getDate() + billing.trialLength);
      const daysUntilTrialEnd = Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilTrialEnd <= 7) {
        reasons.push(`Trial ending in ${daysUntilTrialEnd} days without payment method`);
        recommendations.push('Add payment method before trial expires');
        severity = 'critical';
      } else if (daysUntilTrialEnd <= 14) {
        reasons.push(`Trial ending in ${daysUntilTrialEnd} days without payment method`);
        recommendations.push('Consider adding payment method soon');
        if (severity !== 'critical') severity = 'warning';
      }
    }

    // Check if missing required processor information
    if (billing.vaulted && !billing.processor) {
      reasons.push('Payment method vaulted but processor information missing');
      recommendations.push('Contact support to resolve payment processor configuration');
      if (severity !== 'critical') severity = 'warning';
    }

    // Check if missing vault ID but marked as vaulted
    if (billing.vaulted && !billing.vaultId) {
      reasons.push('Marked as vaulted but missing vault ID');
      recommendations.push('Re-vault payment method or contact support');
      severity = 'critical';
    }

    return {
      needsUpdate: reasons.length > 0,
      reasons,
      severity,
      recommendations,
    };
  }

  /**
   * Quick check - returns boolean for simple needs update validation
   * @param billing - The billing account to check
   * @returns boolean indicating if billing needs update
   */
  static needsBillingUpdate(billing: BillingAccountType | null): boolean {
    return this.validateBillingAccount(billing).needsUpdate;
  }

  /**
   * Check specifically if payment method is vaulted
   * @param billing - The billing account to check
   * @returns boolean indicating if payment method is saved
   */
  static isPaymentMethodSaved(billing: BillingAccountType | null): boolean {
    return billing?.vaulted === true && !!billing?.vaultId;
  }

  /**
   * Check if account is in good standing (active and vaulted)
   * @param billing - The billing account to check
   * @returns boolean indicating if account is in good standing
   */
  static isAccountInGoodStanding(billing: BillingAccountType | null): boolean {
    if (!billing) return false;
    return billing.status === 'active' && billing.vaulted === true && !!billing.vaultId && !billing.needsUpdate;
  }

  /**
   * Get user-friendly message for billing status
   * @param billing - The billing account to check
   * @returns string message for display to user
   */
  static getBillingStatusMessage(billing: BillingAccountType | null): string {
    const validation = this.validateBillingAccount(billing);

    if (!validation.needsUpdate) {
      return 'Your billing information is up to date.';
    }

    if (validation.severity === 'critical') {
      return `Action required: ${validation.reasons[0]}`;
    }

    if (validation.severity === 'warning') {
      return `Attention needed: ${validation.reasons[0]}`;
    }

    return validation.reasons[0] || 'Please review your billing information.';
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use BillingValidator.needsBillingUpdate() instead
 */
export const checkBillingNeedsUpdate = (billing: BillingAccountType | null): boolean => {
  return BillingValidator.needsBillingUpdate(billing);
};
