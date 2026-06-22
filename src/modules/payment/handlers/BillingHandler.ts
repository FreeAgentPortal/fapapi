import moment from 'moment';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import BillingAccount from '../../auth/model/BillingAccount';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import { PaymentHandler } from './PaymentHandler';
import { getPaymentSafeCountryCode } from '../utils/countryHelpers';
import { validatePaymentFormData } from '../utils/paymentValidation';
import PaymentProcessingHandler from './PaymentProcessing.handler';
import { eventBus } from '../../../lib/eventBus';
import PlanSchema from '../../auth/model/PlanSchema';
import { RoleRegistry } from '../../auth/utils/RoleRegistry';

export class BillingHandler {
  constructor(private readonly paymentHandler: PaymentHandler = new PaymentHandler()) {}
  async updateVault(req: AuthenticatedRequest): Promise<Boolean> {
    const { id } = req.params;
    const { paymentFormValues, selectedPlans, billingCycle, paymentMethod, stripeToken } = req.body;
    console.log(req.body);
    // first step find the billing information from the provided profile id
    const billing = await BillingAccount.findOne({ profileId: id }).populate('payor profileId');
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }
    const processorResult = await new PaymentProcessorFactory().smartChooseProcessor();
    const processor = processorResult.processor;
    if (!processor) {
      throw new ErrorUtil('No payment processor is configured', 500);
    }
    // selectedPlans can be an array so we need to plan for an array and single object, we will standardize it to an array for easier handling
    const selectedPlan = Array.isArray(selectedPlans) ? selectedPlans[0] : selectedPlans; // Assuming only one plan can be selected at a time
    const plan = await PlanSchema.findById(selectedPlan?._id ?? req.body?.planId).lean();
    if (!plan) {
      throw new ErrorUtil('Selected plan not found', 404);
    }
    // Check if the selected plan is free
    const isFree = plan?.price === (0 as any);

    // paymentFormValues is legacy, we should be getting all of the formValues from the stripeToken
    // if stripeToken is present, we will use that for validation and processing, otherwise we will fall back to the
    // legacy paymentFormValues for processors that require it (like pyre)
    // Validate payment form data for paid plans based on processor requirements
    if (!isFree) {
      validatePaymentFormData(processor.getProcessorName(), stripeToken ? { stripeToken } : paymentFormValues, 'creditcard');
    }

    // Handle paid plans - require payment processing
    if (!isFree) {
      billing.payor = req.user;
      // we need to update our vaulting
      const vaultResponse = await processor.createVault(
        billing as any,
        {
          email: billing.email,
          phone: billing.payor?.phoneNumber,
          paymentMethod: 'creditcard',
          stripeToken: stripeToken,
          achDetails: paymentFormValues?.achDetails,
        } as any
      );

      if (!vaultResponse.success) {
        console.info(`[BillingHandler] - vaulting was not successful: ${vaultResponse.message}`);
        console.info(vaultResponse);
        throw new ErrorUtil(`${vaultResponse.message}`, 400);
      }

      billing.vaulted = true;

      // Initialize paymentProcessorData if it doesn't exist
      if (!billing.paymentProcessorData) {
        billing.paymentProcessorData = {};
      }

      const name = processor.getProcessorName();
      billing.paymentProcessorData[name] = {
        ...vaultResponse.data, // since processors can return different data its safest to just store what we get back to use later.
      };
      // Mongoose cannot detect mutations on Mixed fields — markModified forces it to include this in the next save
      billing.markModified('paymentProcessorData');
    } else {
      // Handle free plans - no payment processing required
      if (!billing.payor) {
        billing.payor = req.user;
      }

      // For free plans, we don't need vaulting or customer creation
      billing.vaulted = true; // we dont have a vault for them, but this keeps the system from flagging them for updates
      // Keep existing customerId if any, otherwise create a placeholder for free plans
      if (!billing.customerId) {
        billing.customerId = `free_${req.user._id}_${Date.now()}`;
      }
    }

    // Update billing details for both free and paid plans
    billing.plan = plan._id as any;
    billing.isYearly = billingCycle === 'yearly';

    // For free plans, we might not need a nextBillingDate or set it far in the future
    if (isFree) {
      // For free plans, set billing date far in the future or undefined
      billing.nextBillingDate = undefined;
      billing.status = 'active'; // Set status to active for free plans
      billing.needsUpdate = false; // No need for update on free plans
    } else {
      // set the nextBillingDate to the first of next month
      // if the account needed update, we can assume they are switching plans or updating payment
      // so we will not change the nextBillingDate if its already set in the future

      // Only update nextBillingDate if needsUpdate is false (account is in good standing)
      // This prevents giving users a free month when they're updating due to failed payments
      if (!billing.needsUpdate) {
        // if nextBillingDate is not set or is in the past, set it to the first of next month
        if (!billing.nextBillingDate || !moment(billing.nextBillingDate).isAfter(moment())) {
          const nextMonth = moment().add(1, 'month').startOf('month');
          billing.nextBillingDate = nextMonth.toDate();
        }
      }
      billing.status = 'active';
      billing.needsUpdate = false; // if it was true set by admin, this will flip it off

      await billing.save();
      if (!billing.setupFeePaid) {
        const roleMeta = RoleRegistry[req.user.profileRefs[0] ?? 'athlete']; // default to athlete if no role found
        if (!roleMeta.requiresSetupFee) {
          // Role does not require a setup fee — mark as paid and skip payment
          billing.setupFeePaid = true;
        } else {
          // Process the setup fee (amount may be $0, which creates a receipt with no charge)
          const paymentResults = await PaymentProcessingHandler.processPaymentForProfile(billing._id as any, roleMeta.setupFeeAmount, false, 'Account setup fee');
          if (paymentResults.success) {
            billing.setupFeePaid = true;
          } else {
            console.info(`[BillingHandler] - Initial setup fee payment failed: ${paymentResults.message}`);
          }
        }
      }
    }

    // finally set the processor correctly
    billing.processor = processor.getProcessorName();
    await billing.save();

    return true;
  }

  /**
   * @description Request cancellation of a user's account.
   *              Sets `pendingCancellation = true` so the account stays active through the
   *              end of the current billing period. The scheduler will finalize the
   *              cancellation (remove from processor, set inactive) when the next billing
   *              date is reached instead of processing a payment.
   *              Only the account owner or an admin/developer may cancel an account.
   */
  async cancelAccount(req: AuthenticatedRequest): Promise<Boolean> {
    const { id } = req.params;
    const billing = await BillingAccount.findOne({ profileId: id });
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }

    // Ensure the caller is either the account owner or an admin/developer
    const isOwner = billing.payor?.toString() === req.user._id?.toString();
    const isAdmin = req.user.roles?.some((r) => ['admin', 'developer'].includes(r));
    if (!isOwner && !isAdmin) {
      throw new ErrorUtil('Not authorized to cancel this account', 403);
    }

    // Mark the account as pending cancellation so it stays active until the end
    // of the current billing period. The scheduler will finalize cancellation.
    billing.pendingCancellation = true;
    await billing.save();

    // Notify the user that their cancellation request has been received
    eventBus.publish('billing.cancellation.requested', {
      billing: billing.toObject(),
      userId: billing.payor,
    });

    return true;
  }

  /**
   * @description Fetch billing information for user from profile id
   */
  async getVault(id: string): Promise<any> {
    try {
      const billing = await BillingAccount.findOne({ profileId: id }).populate('plan');
      if (!billing) throw new ErrorUtil('Billing Account not found', 404);

      // Handle different processors
      let billingDetails = {};

      if (billing.processor === 'paynetworx') {
        // For PayNetWorx, return the stored token information
        const pnxData = billing.paymentProcessorData?.pnx || {};
        billingDetails = {
          tokenId: pnxData.tokenId,
          tokenName: pnxData.tokenName,
          vaulted: billing.vaulted,
        };
      } else if (billing.processor === 'stripe') {
        // For Stripe, return the stored customer and payment method information
        const stripeData = billing.paymentProcessorData?.stripe || {};
        billingDetails = {
          customerId: stripeData.customer?.id,
          paymentMethodId: stripeData.paymentMethod?.id,
          vaulted: billing.vaulted,
        };
      } else {
        // For other processors (like Pyre/NMI), fetch customer vault info
        const { payload } = await this.paymentHandler.fetchCustomer(billing.customerId);
        billingDetails = payload.vault;
      }

      return {
        ...billing.toObject(),
        billingDetails,
      };
    } catch (err) {
      console.error(err);
      throw new ErrorUtil('Something went wrong', 400);
    }
  }
}
