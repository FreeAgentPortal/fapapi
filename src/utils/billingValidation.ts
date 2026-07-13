import { BillingAccountType } from '../modules/auth/model/BillingAccount';
import logger from './logger';

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
    const isActiveFreePlan = billing.status === 'active' && Number(billing.plan?.price) === 0;
    logger.debug({ status: billing.status, vaulted: billing.vaulted, planPrice: billing.plan?.price, isActiveFreePlan }, 'validateBillingAccount: called');

    // Primary check: Payment information not vaulted
    if (!billing.vaulted && !isActiveFreePlan) {
      logger.debug({ vaulted: billing.vaulted, isActiveFreePlan }, 'validateBillingAccount: payment method not vaulted and not a free plan');
      reasons.push('Payment information not saved (not vaulted)');
      recommendations.push('Add payment method to vault for automatic billing');
      severity = 'critical';
    }

    // Check if account is inactive or suspended
    if (billing.status === 'inactive' || billing.status === 'suspended') {
      logger.debug({ status: billing.status }, 'validateBillingAccount: account is inactive or suspended');
      reasons.push(`Account status is ${billing.status}`);
      recommendations.push('Update payment information to reactivate account');
      severity = 'critical';
    }

    // Check if explicitly marked as needing update
    if (billing.needsUpdate) {
      logger.debug({}, 'validateBillingAccount: account flagged for manual update');
      reasons.push('Billing account flagged for manual update');
      recommendations.push('Review and update billing information');
      if (severity !== 'critical') severity = 'warning';
    }

    // Check if next billing date has passed and account is not vaulted
    if (billing.nextBillingDate && billing.nextBillingDate < new Date() && !billing.vaulted && !isActiveFreePlan) {
      logger.debug(
        { nextBillingDate: billing.nextBillingDate, vaulted: billing.vaulted, isActiveFreePlan },
        'validateBillingAccount: next billing date passed without payment method'
      );
      reasons.push('Next billing date has passed without payment method on file');
      recommendations.push('Add payment method before next billing cycle');
      severity = 'critical';
    }

    // Check if trial is ending soon and no payment method
    // if (billing.status === 'trialing' && !billing.vaulted) {
    //   const trialEndDate = new Date(billing.createdAt);
    //   trialEndDate.setDate(trialEndDate.getDate() + billing.trialLength);
    //   const daysUntilTrialEnd = Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    //   if (daysUntilTrialEnd <= 7) {
    //     reasons.push(`Trial ending in ${daysUntilTrialEnd} days without payment method`);
    //     recommendations.push('Add payment method before trial expires');
    //     severity = 'critical';
    //   } else if (daysUntilTrialEnd <= 14) {
    //     reasons.push(`Trial ending in ${daysUntilTrialEnd} days without payment method`);
    //     recommendations.push('Consider adding payment method soon');
    //     if (severity !== 'critical') severity = 'warning';
    //   }
    // }

    // Check if missing required processor information
    if (billing.vaulted && !billing.processor) {
      logger.debug({}, 'validateBillingAccount: vaulted but processor information missing');
      reasons.push('Payment method vaulted but processor information missing');
      recommendations.push('Contact support to resolve payment processor configuration');
      if (severity !== 'critical') severity = 'warning';
    }

    const result = {
      needsUpdate: reasons.length > 0,
      reasons,
      severity,
      recommendations,
    };
    logger.debug({ needsUpdate: result.needsUpdate, severity: result.severity, reasonCount: result.reasons.length }, 'validateBillingAccount: validation complete');
    return result;
  }

  /**
   * Quick check - returns boolean for simple needs update validation
   * @param billing - The billing account to check
   * @returns boolean indicating if billing needs update
   */
  static needsBillingUpdate(billing: BillingAccountType | null): boolean {
    const result = this.validateBillingAccount(billing).needsUpdate;
    logger.debug({ needsUpdate: result }, 'needsBillingUpdate: result');
    return result;
  }

  /**
   * Check specifically if payment method is vaulted
   * @param billing - The billing account to check
   * @returns boolean indicating if payment method is saved
   */
  static isPaymentMethodSaved(billing: BillingAccountType | null): boolean {
    const result = billing?.vaulted === true;
    logger.debug({ vaulted: billing?.vaulted, result }, 'isPaymentMethodSaved: result');
    return result;
  }

  /**
   * Check if account is in good standing (active and vaulted)
   * @param billing - The billing account to check
   * @returns boolean indicating if account is in good standing
   */
  static isAccountInGoodStanding(billing: BillingAccountType | null): boolean {
    if (!billing) {
      logger.debug({}, 'isAccountInGoodStanding: no billing account — returning false');
      return false;
    }
    const isActiveFreePlan = billing.status === 'active' && Number(billing.plan?.price) === 0;
    const result = billing.status === 'active' && (isActiveFreePlan || billing.vaulted === true) && !billing.needsUpdate;
    logger.debug({ status: billing.status, isActiveFreePlan, vaulted: billing.vaulted, needsUpdate: billing.needsUpdate, result }, 'isAccountInGoodStanding: result');
    return result;
  }

  /**
   * Get user-friendly message for billing status
   * @param billing - The billing account to check
   * @returns string message for display to user
   */
  static getBillingStatusMessage(billing: BillingAccountType | null): string {
    logger.debug({}, 'getBillingStatusMessage: called');
    const validation = this.validateBillingAccount(billing);

    if (!validation.needsUpdate) {
      logger.debug({}, 'getBillingStatusMessage: billing is up to date');
      return 'Your billing information is up to date.';
    }

    if (validation.severity === 'critical') {
      logger.debug({ reason: validation.reasons[0] }, 'getBillingStatusMessage: critical severity');
      return `Action required: ${validation.reasons[0]}`;
    }

    if (validation.severity === 'warning') {
      logger.debug({ reason: validation.reasons[0] }, 'getBillingStatusMessage: warning severity');
      return `Attention needed: ${validation.reasons[0]}`;
    }

    logger.debug({ reason: validation.reasons[0] }, 'getBillingStatusMessage: info severity');
    return validation.reasons[0] || 'Please review your billing information.';
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use BillingValidator.needsBillingUpdate() instead
 */
export const checkBillingNeedsUpdate = (billing: BillingAccountType | null): boolean => {
  logger.debug({}, 'checkBillingNeedsUpdate: called (legacy)');
  return BillingValidator.needsBillingUpdate(billing);
};
