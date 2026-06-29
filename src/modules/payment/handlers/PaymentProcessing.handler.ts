import BillingAccount, { BillingAccountType } from '../../auth/model/BillingAccount';
import Receipt, { ReceiptType } from '../models/Receipt';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import PlanSchema from '../../auth/model/PlanSchema';
import PaymentProcessor from '../classes/PaymentProcess';
import { eventBus } from '../../../lib/eventBus';
import { applyBillingPlanSnapshot, calculatePlanCycleAmount } from '../utils/billingPlanUtils';

type BillingChargeOptions = {
  updateBillingDate?: boolean;
  description?: string;
  failureMutationMode?: 'standard' | 'none';
  planOverride?: any;
};

export default class PaymentProcessingHandler {
  private static processor = null as PaymentProcessor | null;

  constructor() {
    // initialization of instance
    if (!PaymentProcessingHandler.processor) {
      PaymentProcessingHandler.processor = new PaymentProcessorFactory().smartChooseProcessor().then((res) => {
        if (!res.processor) {
          throw new Error('No payment processor is configured');
        }
        console.info('Using payment processor:', res.processor.getProcessorName());
        return res.processor as PaymentProcessor;
      }) as unknown as PaymentProcessor;
    }
  }

  public static async processScheduledPayments(): Promise<{ success: boolean; message: string; results?: any }> {
    try {
      console.info('[PaymentProcessingHandler] Starting scheduled payment processing...');
      if (!this.processor) {
        this.processor = await new PaymentProcessorFactory().smartChooseProcessor().then((res) => {
          if (!res.processor) {
            throw new Error('No payment processor is configured');
          }
          return res.processor as PaymentProcessor;
        });
      }

      const appliedPlanChanges = await this.applyDueScheduledPlanChanges();
      if (appliedPlanChanges > 0) {
        console.info(`[PaymentProcessingHandler] Applied ${appliedPlanChanges} scheduled plan changes before billing.`);
      }

      // Get all profiles due for payment
      const profilesDue = await this.getProfilesDueForPayment();

      // Get all profiles whose billing date has been reached and want to cancel
      const profilesPendingCancellation = await this.getProfilesPendingCancellation();

      if (profilesDue.length === 0 && profilesPendingCancellation.length === 0) {
        console.info('[PaymentProcessingHandler] No profiles due for payment.');
        return { success: true, message: 'No profiles due for payment.' };
      }

      console.info(`[PaymentProcessingHandler] Found ${profilesDue.length} profiles due for payment.`);
      const results = {
        total: profilesDue.length,
        successful: 0,
        failed: 0,
        cancelled: 0,
        errors: [] as string[],
      };
      // if we still dont have a processor here, we have a big problem
      if (!this.processor) {
        throw new Error('No payment processor is configured');
      }
      // Process each profile
      for (const profile of profilesDue) {
        try {
          const result = await this.processPaymentForProfile(profile._id as any, undefined, true, 'Scheduled subscription payment');
          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(`Profile ${profile._id}: ${result.message}`);
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Profile ${profile._id}: ${error.message}`);
          console.error(`[PaymentProcessingHandler] Error processing profile ${profile._id}:`, error);
        }
      }

      // Finalize cancellations for accounts whose billing period has ended
      if (profilesPendingCancellation.length > 0) {
        console.info(`[PaymentProcessingHandler] Finalizing ${profilesPendingCancellation.length} pending cancellations.`);
        for (const profile of profilesPendingCancellation) {
          try {
            await this.finalizeAccountCancellation(profile);
            results.cancelled++;
          } catch (error: any) {
            results.errors.push(`Cancellation for ${profile._id}: ${error.message}`);
            console.error(`[PaymentProcessingHandler] Error finalizing cancellation for profile ${profile._id}:`, error);
          }
        }
      }

      console.info('[PaymentProcessingHandler] Scheduled payments processing completed.', results);

      return {
        success: true,
        message: `Processed ${results.total} profiles: ${results.successful} successful, ${results.failed} failed, ${results.cancelled} cancelled.`,
        results,
      };
    } catch (error: any) {
      console.error('[PaymentProcessingHandler] Error processing scheduled payments:', error);
      return { success: false, message: 'Error processing scheduled payments: ' + error.message };
    }
  }

  public static async getProfilesDueForPayment(): Promise<BillingAccountType[]> {
    try {
      console.info('[PaymentProcessingHandler] Fetching profiles due for payment...');

      const currentDate = new Date();
      currentDate.setHours(23, 59, 59, 999); // End of today

      const profilesDue = await BillingAccount.find({
        nextBillingDate: { $lte: currentDate },
        // status is active or trialing
        status: { $in: ['active', 'trialing'] },
        vaulted: true,
        plan: { $exists: true, $ne: null },
        needsUpdate: { $ne: true }, // Exclude accounts needing update
        pendingCancellation: { $ne: true }, // Exclude accounts pending cancellation
      })
        .populate('plan')
        .populate('payor')
        .lean();

      // Filter out free plans (price = 0)
      const paidProfilesDue = profilesDue.filter((profile: any) => {
        return profile.plan && profile.plan.price > 0;
      });

      console.info(`[PaymentProcessingHandler] Found ${paidProfilesDue.length} profiles due for payment.`);
      return paidProfilesDue as BillingAccountType[];
    } catch (error: any) {
      console.error('[PaymentProcessingHandler] Error fetching profiles due for payment:', error);
      return [];
    }
  }

  public static async getProfilesPendingCancellation(): Promise<BillingAccountType[]> {
    try {
      const currentDate = new Date();
      currentDate.setHours(23, 59, 59, 999); // End of today

      const profiles = await BillingAccount.find({
        pendingCancellation: true,
        nextBillingDate: { $lte: currentDate },
        status: { $in: ['active', 'trialing'] },
      })
        .populate('plan')
        .populate('payor')
        .lean();

      console.info(`[PaymentProcessingHandler] Found ${profiles.length} profiles pending cancellation.`);
      return profiles as BillingAccountType[];
    } catch (error: any) {
      console.error('[PaymentProcessingHandler] Error fetching profiles pending cancellation:', error);
      return [];
    }
  }

  public static async applyDueScheduledPlanChanges(): Promise<number> {
    try {
      const now = new Date();
      const billings = await BillingAccount.find({
        'scheduledPlanChange.effectiveDate': { $lte: now },
        status: { $in: ['active', 'trialing'] },
      });

      let appliedCount = 0;

      for (const billing of billings) {
        const scheduledPlanChange = billing.scheduledPlanChange;
        if (!scheduledPlanChange?.plan) {
          continue;
        }

        const livePlan = await PlanSchema.findById(scheduledPlanChange.plan).select('price yearlyDiscount').lean();
        if (!livePlan) {
          console.warn(`[PaymentProcessingHandler] Scheduled plan change skipped because plan ${scheduledPlanChange.plan} no longer exists.`);
          continue;
        }

        applyBillingPlanSnapshot(billing, scheduledPlanChange as any);
        billing.scheduledPlanChange = undefined;
        billing.status = 'active';
        billing.needsUpdate = false;

        const cycleAmount = calculatePlanCycleAmount(livePlan, Boolean(billing.isYearly));
        if (cycleAmount === 0) {
          billing.nextBillingDate = undefined;
        }

        await billing.save();
        appliedCount++;
      }

      return appliedCount;
    } catch (error: any) {
      console.error('[PaymentProcessingHandler] Error applying scheduled plan changes:', error);
      return 0;
    }
  }

  /**
   * Finalize the cancellation of an account whose billing period has ended:
   * removes the customer from the payment processor and marks the account inactive.
   */
  public static async finalizeAccountCancellation(billingAccount: BillingAccountType): Promise<void> {
    // Remove customer from the payment processor.
    // Non-fatal: we always mark the account as cancelled regardless.
    if (billingAccount.processor) {
      try {
        const factory = new PaymentProcessorFactory();
        const processor = factory.chooseProcessor(billingAccount.processor);
        const customerId = billingAccount.processor === 'stripe' ? (billingAccount.paymentProcessorData as any)?.stripe?.customer?.id : billingAccount.customerId;

        if (customerId) {
          await processor.deleteVault(customerId);
        }
      } catch (err) {
        console.error(`[PaymentProcessingHandler] Error removing customer from processor for ${billingAccount._id}:`, err);
      }
    }

    await BillingAccount.findByIdAndUpdate(billingAccount._id, {
      status: 'inactive',
      pendingCancellation: false,
      needsUpdate: false,
    });

    console.info(`[PaymentProcessingHandler] Account ${billingAccount._id} cancelled successfully.`);

    eventBus.publish('billing.account.cancelled', {
      billing: billingAccount,
      userId: (billingAccount.payor as any)?._id ?? billingAccount.payor,
    });
  }

  public static async processPaymentForProfile(
    profileId: string,
    amount?: number,
    updateBillingDate: boolean = true,
    description?: string
  ): Promise<{ success: boolean; message: string; receipt?: ReceiptType }> {
    return this.processBillingCharge(profileId, amount, {
      updateBillingDate,
      description,
      failureMutationMode: 'standard',
    });
  }

  public static async processPlanChangeCharge(
    billingAccountId: string,
    amountInCents: number,
    planOverride: any,
    description: string
  ): Promise<{ success: boolean; message: string; receipt?: ReceiptType }> {
    return this.processBillingCharge(billingAccountId, amountInCents, {
      updateBillingDate: false,
      description,
      failureMutationMode: 'none',
      planOverride,
    });
  }

  private static async processBillingCharge(
    billingAccountId: string,
    amount?: number,
    options: BillingChargeOptions = {}
  ): Promise<{ success: boolean; message: string; receipt?: ReceiptType }> {
    const updateBillingDate = options.updateBillingDate ?? true;
    const failureMutationMode = options.failureMutationMode ?? 'standard';
    const description = options.description;

    try {
      console.info(`[PaymentProcessingHandler] Processing payment for billing account ${billingAccountId}...`);

      // Ensure processor is initialized
      if (!this.processor) {
        console.warn(`[PaymentProcessingHandler] Processor not initialized. Initializing now...`);
        const result = await new PaymentProcessorFactory().smartChooseProcessor();
        if (!result.processor) {
          throw new Error('No payment processor is configured');
        }
        this.processor = result.processor as PaymentProcessor;
      }

      const processorName = await this.processor.getProcessorName();
      if (!processorName) {
        throw new Error('Failed to get processor name');
      }

      // Get billing account with populated data
      const billingAccount = await BillingAccount.findById(billingAccountId).populate('plan').populate('payor');

      if (!billingAccount) {
        console.log(`[PaymentProcessingHandler] Billing account was not found for id: ${billingAccountId}`);
        throw new Error(`Billing account not found for profile ${billingAccountId}`);
      }

      if (!billingAccount?.plan?._id || !billingAccount?.payor?._id) {
        console.log(billingAccount);
        // for now do nothing, dont throw an error. plan and payor should always be populated here, but for some reason
        // the service is seeing some accounts without them and throwing errors causing scheduled payments to fail.
        // throw new Error(`Missing plan or payor data for billing account ${billingAccountId}`);
      }

      // Check if we have payment processor data
      if (!billingAccount.paymentProcessorData) {
        throw new Error(`No payment processor data found for billing account ${billingAccountId}`);
      }

      const processorData = billingAccount.paymentProcessorData[processorName as any];

      if (!processorData) {
        // this is a rare case, but it can happen if the user has multiple processors and the one we want to use is not set up.
        // we need to then inform them to update their payment information.
        console.warn(`[PaymentProcessingHandler] No Processor Information found for processor ${processorName} on billing account ${billingAccountId}`);

        if (failureMutationMode === 'standard') {
          billingAccount.needsUpdate = true;
          await billingAccount.save();
          eventBus.publish('billing.needsUpdate', { profileId: billingAccountId, reason: 'Missing processor data for scheduled payment' });
        }

        throw new Error(`No Processor Information found for processor ${processorName} on billing account ${billingAccountId}`);
      }

      // Get plan data for receipt creation
      const plan = options.planOverride ?? (billingAccount.plan as any);
      let calculatedAmount: number;

      // if amount is not provided, calculate based on plan and billing cycle
      if (amount === undefined) {
        if (!billingAccount.plan) {
          throw new Error(`No plan associated with billing account for profile ${billingAccountId}`);
        }
        // Calculate amount based on plan and billing cycle
        calculatedAmount = parseFloat(plan.price);
        // Apply yearly discount if applicable
        if (billingAccount.isYearly && plan.yearlyDiscount) {
          calculatedAmount = calculatedAmount * 12 * (1 - plan.yearlyDiscount / 100);
        }
        // finally, subtract any credits
        if (billingAccount.credits && billingAccount.credits > 0) {
          const originalAmount = calculatedAmount;
          calculatedAmount = Math.max(0, calculatedAmount - billingAccount.credits);
          // Deduct used credits from account
          const creditsUsed = originalAmount - calculatedAmount;
          billingAccount.credits = Math.max(0, billingAccount.credits - creditsUsed);
          await billingAccount.save();
        }
      } else {
        // amount is passed in, use it directly
        // amount passed in should be in cents, i.e. 5000 for $50, we need to convert it to dollars for processing and receipts
        calculatedAmount = amount / 100;
      }

      // Check if amount is 0 - skip payment processing and create success receipt
      if (calculatedAmount === 0) {
        console.info(`[PaymentProcessingHandler] Amount is $0 for billing account ${billingAccountId} - skipping payment processing and creating success receipt`);

        // Create a mock successful payment result for receipt creation
        const mockPaymentResult = {
          success: true,
          status: 'succeeded',
          transactionId: `CREDIT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: 'Payment covered by account credits',
          data: { covered_by_credits: true },
        };

        // Create success receipt for zero-amount payment
        const receiptDescription = description || (amount !== undefined && !updateBillingDate ? 'One-time payment covered by credits' : undefined);
        const receipt = await this.createSuccessReceipt(billingAccount, mockPaymentResult, calculatedAmount, plan, receiptDescription);

        // Update next billing date only for subscription payments
        if (updateBillingDate) {
          await this.updateNextBillingDate(billingAccount);
        } else {
          // For immediate payments, just update status but not billing date
          await BillingAccount.findByIdAndUpdate(billingAccount._id, {
            status: 'active',
            needsUpdate: false,
          });
        }

        console.info(`[PaymentProcessingHandler] Zero-amount payment processed successfully for billing account ${billingAccountId} using account credits`);
        return {
          success: true,
          message: `Payment of $${calculatedAmount.toFixed(2)} covered by account credits`,
          receipt,
        };
      }

      // add the amount to processorData
      processorData.amount = calculatedAmount;

      console.info(`[PaymentProcessingHandler] Processing payment of $${calculatedAmount} for billing account ${billingAccountId} using token ${processorData.tokenId}`);

      // processor is expected to handle the information passed into it
      const paymentResult = (await this.processor?.processPayment(processorData)) as any;

      if (paymentResult.success) {
        // Payment successful - create success receipt
        const receiptDescription = description || (amount !== undefined && !updateBillingDate ? 'One-time payment processed successfully' : undefined); // Use default subscription description
        const receipt = await this.createSuccessReceipt(billingAccount, paymentResult, calculatedAmount, plan, receiptDescription);

        // Update next billing date only for subscription payments
        if (updateBillingDate) {
          await this.updateNextBillingDate(billingAccount);
        } else {
          // For immediate payments, just update status but not billing date
          await BillingAccount.findByIdAndUpdate(billingAccount._id, {
            status: 'active',
            needsUpdate: false,
          });
        }

        console.info(`[PaymentProcessingHandler] Payment processed successfully for billing account ${billingAccountId}`);
        return {
          success: true,
          message: `Payment of $${calculatedAmount.toFixed(2)} processed successfully`,
          receipt,
        };
      } else {
        // Payment failed - create failure receipt
        const receiptDescription = description || (amount !== undefined && !updateBillingDate ? 'One-time payment failed' : undefined); // Use default subscription description
        const receipt = await this.createFailureReceipt(billingAccount, paymentResult, calculatedAmount, plan, receiptDescription);

        if (failureMutationMode === 'standard') {
          // Mark account as needing update
          await BillingAccount.findByIdAndUpdate(billingAccountId, {
            needsUpdate: true,
            status: 'suspended', // Optional: suspend account on payment failure
          });
        }

        console.info(`[PaymentProcessingHandler] Payment failed for billing account ${billingAccountId}: ${paymentResult.message}`);
        return {
          success: false,
          message: `Payment failed: ${paymentResult.message}`,
          receipt,
        };
      }
    } catch (error: any) {
      console.error(`[PaymentProcessingHandler] Error processing payment for billing account ${billingAccountId}:`, error);

      // Try to create an error receipt if we have enough information
      try {
        const billingAccount = await BillingAccount.findById(billingAccountId).populate('plan').populate('payor');
        if (billingAccount) {
          const receiptDescription = description || (amount !== undefined && !updateBillingDate ? 'One-time payment processing error' : 'Subscription payment processing error');
          await this.createErrorReceipt(billingAccount, error.message, receiptDescription);

          if (failureMutationMode === 'standard') {
            await BillingAccount.findByIdAndUpdate(billingAccountId, { needsUpdate: true });
          }
        }
      } catch (receiptError) {
        console.error('Failed to create error receipt:', receiptError);
      }

      return { success: false, message: error.message };
    }
  }

  private static async createSuccessReceipt(billingAccount: BillingAccountType, paymentResult: any, amount: number, plan: any, description?: string): Promise<ReceiptType> {
    const receipt = new Receipt({
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      billingAccountId: billingAccount._id,
      userId: billingAccount.payor._id,
      status: paymentResult.status,
      type: 'payment',
      amount: amount,
      currency: 'USD',
      description: description || (plan ? `${billingAccount.isYearly ? 'Annual' : 'Monthly'} subscription payment for ${plan.name}` : 'Payment processed successfully'),
      planInfo: plan
        ? {
            planId: plan._id,
            planName: plan.name,
            planPrice: parseFloat(plan.price),
            billingCycle: billingAccount.isYearly ? 'yearly' : 'monthly',
          }
        : undefined,
      processor: {
        name: await this.processor?.getProcessorName(),
        transactionId: paymentResult.transactionId,
        response: paymentResult.data,
      },
      customer: {
        email: billingAccount.email,
        name: `${billingAccount.payor.firstName} ${billingAccount.payor.lastName}`,
        phone: billingAccount.payor.phoneNumber || '',
      },
      transactionDate: new Date(),
    });

    await receipt.save();
    console.info(`[PaymentProcessingHandler] Success receipt created: ${receipt.transactionId}`);

    // Emit payment success event for notifications
    eventBus.publish('billing.payment.success', {
      receiptId: receipt._id,
      receipt: receipt.toObject(),
    });

    return receipt;
  }

  private static async createFailureReceipt(billingAccount: BillingAccountType, paymentResult: any, amount: number, plan: any, description?: string): Promise<ReceiptType> {
    const receipt = new Receipt({
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      billingAccountId: billingAccount._id,
      userId: billingAccount.payor._id,
      status: 'failed',
      type: 'payment',
      amount: amount,
      currency: 'USD',
      description: description || (plan ? `Failed ${billingAccount.isYearly ? 'annual' : 'monthly'} subscription payment for ${plan.name}` : 'Payment processing failed'),
      planInfo: plan
        ? {
            planId: plan._id,
            planName: plan.name,
            planPrice: parseFloat(plan.price),
            billingCycle: billingAccount.isYearly ? 'yearly' : 'monthly',
          }
        : undefined,
      processor: {
        name: await this.processor?.getProcessorName(),
        transactionId: paymentResult.transactionId || 'N/A',
        response: paymentResult,
      },
      customer: {
        email: billingAccount.email,
        name: `${billingAccount.payor.firstName} ${billingAccount.payor.lastName}`,
        phone: billingAccount.payor.phoneNumber || '',
      },
      failure: {
        reason: paymentResult.message || 'Payment processing failed',
        code: paymentResult.data?.response_code || 'UNKNOWN',
      },
      transactionDate: new Date(),
    });

    await receipt.save();
    console.info(`[PaymentProcessingHandler] Failure receipt created: ${receipt.transactionId}`);

    // Emit payment failure event for notifications
    eventBus.publish('billing.payment.failed', {
      receiptId: receipt._id,
      receipt: receipt.toObject(),
    });

    return receipt;
  }

  private static async createErrorReceipt(billingAccount: BillingAccountType, errorMessage: string, description?: string): Promise<ReceiptType> {
    const receipt = new Receipt({
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      billingAccountId: billingAccount._id,
      userId: billingAccount.payor?._id,
      status: 'failed',
      type: 'payment',
      amount: 0,
      currency: 'USD',
      description: description || 'Payment processing error occurred',
      processor: {
        name: await this.processor?.getProcessorName(),
        transactionId: 'ERROR',
        response: { error: errorMessage },
      },
      customer: {
        email: billingAccount.email,
        name: billingAccount.payor ? `${billingAccount.payor.firstName} ${billingAccount.payor.lastName}` : 'Unknown',
        phone: billingAccount.payor?.phoneNumber || '',
      },
      failure: {
        reason: errorMessage,
        code: 'PROCESSING_ERROR',
      },
      transactionDate: new Date(),
    });

    await receipt.save();
    console.info(`[PaymentProcessingHandler] Error receipt created: ${receipt.transactionId}`);
    return receipt;
  }

  private static async updateNextBillingDate(billingAccount: BillingAccountType): Promise<void> {
    const nextMonth = new Date();

    if (billingAccount.isYearly) {
      // Set to next year, same month
      nextMonth.setFullYear(nextMonth.getFullYear() + 1);
    } else {
      // Set to first day of next month
      nextMonth.setMonth(nextMonth.getMonth() + 1);
    }

    // Set to first day of the month
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);

    await BillingAccount.findByIdAndUpdate(billingAccount._id, {
      nextBillingDate: nextMonth,
      status: 'active', // Ensure status is active after successful payment
      needsUpdate: false, // Clear needsUpdate flag, if its been set after a successful payment
    });

    console.info(`[PaymentProcessingHandler] Updated next billing date for ${billingAccount._id} to ${nextMonth.toISOString()}`);
  }
}
