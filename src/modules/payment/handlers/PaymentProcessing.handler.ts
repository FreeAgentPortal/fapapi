import BillingAccount, { BillingAccountType } from '../../auth/model/BillingAccount';
import Receipt, { ReceiptType } from '../models/Receipt';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import PlanSchema from '../../auth/model/PlanSchema';
import PaymentProcessor from '../classes/PaymentProcess';
import { eventBus } from '../../../lib/eventBus';

export default class PaymentProcessingHandler {
  private static processor = null as PaymentProcessor | null;

  constructor() {
    // initialization of instance
    if (!PaymentProcessingHandler.processor) {
      PaymentProcessingHandler.processor = new PaymentProcessorFactory().smartChooseProcessor().then((res) => {
        if (!res.processor) {
          throw new Error('No payment processor is configured');
        }
        console.log('Using payment processor:', res.processor.getProcessorName());
        return res.processor as PaymentProcessor;
      }) as unknown as PaymentProcessor;
    }
  }

  public static async processScheduledPayments(): Promise<{ success: boolean; message: string; results?: any }> {
    try {
      console.log('[PaymentProcessingHandler] Starting scheduled payment processing...');

      // Get all profiles due for payment
      const profilesDue = await this.getProfilesDueForPayment();

      if (profilesDue.length === 0) {
        console.log('[PaymentProcessingHandler] No profiles due for payment.');
        return { success: true, message: 'No profiles due for payment.' };
      }

      console.log(`[PaymentProcessingHandler] Found ${profilesDue.length} profiles due for payment.`);

      const results = {
        total: profilesDue.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process each profile
      for (const profile of profilesDue) {
        try {
          const result = await this.processPaymentForProfile(profile._id.toString());
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

      console.log('[PaymentProcessingHandler] Scheduled payments processing completed.', results);

      return {
        success: true,
        message: `Processed ${results.total} profiles: ${results.successful} successful, ${results.failed} failed.`,
        results,
      };
    } catch (error: any) {
      console.error('[PaymentProcessingHandler] Error processing scheduled payments:', error);
      return { success: false, message: 'Error processing scheduled payments: ' + error.message };
    }
  }

  public static async getProfilesDueForPayment(): Promise<BillingAccountType[]> {
    try {
      console.log('[PaymentProcessingHandler] Fetching profiles due for payment...');

      const currentDate = new Date();
      currentDate.setHours(23, 59, 59, 999); // End of today

      const profilesDue = await BillingAccount.find({
        nextBillingDate: { $lte: currentDate },
        // status is active or trialing
        status: { $in: ['active', 'trialing'] },
        vaulted: true,
        plan: { $exists: true, $ne: null },
        needsUpdate: { $ne: true }, // Exclude accounts needing update
      })
        .populate('plan')
        .populate('payor')
        .lean();

      // Filter out free plans (price = 0)
      const paidProfilesDue = profilesDue.filter((profile: any) => {
        return profile.plan && profile.plan.price > 0;
      });

      console.log(`[PaymentProcessingHandler] Found ${paidProfilesDue.length} profiles due for payment.`);
      return paidProfilesDue as BillingAccountType[];
    } catch (error: any) {
      console.error('[PaymentProcessingHandler] Error fetching profiles due for payment:', error);
      return [];
    }
  }

  public static async processPaymentForProfile(profileId: string): Promise<{ success: boolean; message: string; receipt?: ReceiptType }> {
    try {
      console.log(`[PaymentProcessingHandler] Processing payment for profile ${profileId}...`);

      // Get billing account with populated data
      const billingAccount = await BillingAccount.findById(profileId).populate('plan').populate('payor');

      if (!billingAccount) {
        throw new Error(`Billing account not found for profile ${profileId}`);
      }

      if (!billingAccount.plan || !billingAccount.payor) {
        throw new Error(`Missing plan or payor data for profile ${profileId}`);
      }

      // Check if we have payment processor data
      if (!billingAccount.paymentProcessorData) {
        throw new Error(`No payment processor data found for profile ${profileId}`);
      }

      // Get the processor name and token data
      const processorName = await this.processor?.getProcessorName(); // we only want the name of the processor we want to use
      const processorData = billingAccount.paymentProcessorData[processorName as any];

      if (!processorData) {
        // this is a rare case, but it can happen if the user has multiple processors and the one we want to use is not set up.
        // we need to then inform them to update their payment information.
        console.warn(`[PaymentProcessingHandler] No Processor Information found for processor ${processorName} on profile ${profileId}`);
        billingAccount.needsUpdate = true;
        await billingAccount.save();
        eventBus.publish('billing.needsUpdate', { profileId, reason: 'Missing processor data for scheduled payment' });
        throw new Error(`No Processor Information found for processor ${processorName} on profile ${profileId}`);
      }

      // Calculate amount based on plan and billing cycle
      const plan = billingAccount.plan as any;
      let amount = parseFloat(plan.price);

      // Apply yearly discount if applicable
      if (billingAccount.isYearly && plan.yearlyDiscount) {
        amount = amount * 12 * (1 - plan.yearlyDiscount / 100);
      }

      // check if the customer needs the one-time setup fee
      if (!billingAccount.setupFeePaid) {
        amount += 50; // assuming a flat $50 setup fee
        billingAccount.setupFeePaid = true; // mark as paid
        await billingAccount.save();
      }

      console.log(`[PaymentProcessingHandler] Processing payment of $${amount} for profile ${profileId} using token ${processorData.tokenId}`);

      // processor is expected to handle the information passed into it
      const paymentResult = (await this.processor?.processPayment(processorData)) as any;

      if (paymentResult.success) {
        // Payment successful - create success receipt
        const receipt = await this.createSuccessReceipt(billingAccount, paymentResult, amount, plan);

        // Update next billing date
        await this.updateNextBillingDate(billingAccount);

        console.log(`[PaymentProcessingHandler] Payment processed successfully for profile ${profileId}`);
        return {
          success: true,
          message: `Payment of $${amount.toFixed(2)} processed successfully`,
          receipt,
        };
      } else {
        // Payment failed - create failure receipt
        const receipt = await this.createFailureReceipt(billingAccount, paymentResult, amount, plan);

        // Mark account as needing update
        await BillingAccount.findByIdAndUpdate(profileId, {
          needsUpdate: true,
          status: 'suspended', // Optional: suspend account on payment failure
        });

        console.log(`[PaymentProcessingHandler] Payment failed for profile ${profileId}: ${paymentResult.message}`);
        return {
          success: false,
          message: `Payment failed: ${paymentResult.message}`,
          receipt,
        };
      }
    } catch (error: any) {
      console.error(`[PaymentProcessingHandler] Error processing payment for profile ${profileId}:`, error);

      // Try to create an error receipt if we have enough information
      try {
        const billingAccount = await BillingAccount.findById(profileId).populate('plan').populate('payor');
        if (billingAccount) {
          await this.createErrorReceipt(billingAccount, error.message);
          await BillingAccount.findByIdAndUpdate(profileId, { needsUpdate: true });
        }
      } catch (receiptError) {
        console.error('Failed to create error receipt:', receiptError);
      }

      return { success: false, message: error.message };
    }
  }

  private static async createSuccessReceipt(billingAccount: BillingAccountType, paymentResult: any, amount: number, plan: any): Promise<ReceiptType> {
    const receipt = new Receipt({
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      billingAccountId: billingAccount._id,
      userId: billingAccount.payor._id,
      status: paymentResult.status,
      type: 'payment',
      amount: amount,
      currency: 'USD',
      planInfo: {
        planId: plan._id,
        planName: plan.name,
        planPrice: parseFloat(plan.price),
        billingCycle: billingAccount.isYearly ? 'yearly' : 'monthly',
      },
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
    console.log(`[PaymentProcessingHandler] Success receipt created: ${receipt.transactionId}`);
    return receipt;
  }

  private static async createFailureReceipt(billingAccount: BillingAccountType, paymentResult: any, amount: number, plan: any): Promise<ReceiptType> {
    const receipt = new Receipt({
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      billingAccountId: billingAccount._id,
      userId: billingAccount.payor._id,
      status: 'failed',
      type: 'payment',
      amount: amount,
      currency: 'USD',
      planInfo: {
        planId: plan._id,
        planName: plan.name,
        planPrice: parseFloat(plan.price),
        billingCycle: billingAccount.isYearly ? 'yearly' : 'monthly',
      },
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
    console.log(`[PaymentProcessingHandler] Failure receipt created: ${receipt.transactionId}`);
    return receipt;
  }

  private static async createErrorReceipt(billingAccount: BillingAccountType, errorMessage: string): Promise<ReceiptType> {
    const receipt = new Receipt({
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      billingAccountId: billingAccount._id,
      userId: billingAccount.payor?._id,
      status: 'failed',
      type: 'payment',
      amount: 0,
      currency: 'USD',
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
    console.log(`[PaymentProcessingHandler] Error receipt created: ${receipt.transactionId}`);
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

    console.log(`[PaymentProcessingHandler] Updated next billing date for ${billingAccount._id} to ${nextMonth.toISOString()}`);
  }
}
