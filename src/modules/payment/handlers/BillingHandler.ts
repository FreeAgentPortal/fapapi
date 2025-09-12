import moment from 'moment';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import BillingAccount from '../../auth/model/BillingAccount';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import { PaymentHandler } from './PaymentHandler';
import { getPaymentSafeCountryCode } from '../utils/countryHelpers';

export class BillingHandler {
  constructor(private readonly paymentHandler: PaymentHandler = new PaymentHandler()) {}
  async updateVault(req: AuthenticatedRequest): Promise<Boolean> {
    const { id } = req.params;
    const { paymentFormValues, selectedPlans, billingCycle, paymentMethod } = req.body;
    console.log(paymentFormValues);

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

    // Check if the selected plan is free
    const selectedPlan = selectedPlans[0];
    const isFree = selectedPlan.price === 0;

    // Handle paid plans - require payment processing
    if (!isFree) {
      // if we dont have a customerId on billing object we need to create that first
      if (!billing.customerId) {
        const customer = await this.paymentHandler.createCustomer(req.user);
        // update the billing object with the customerId
        billing.customerId = customer.payload._id;
        billing.payor = req.user;
      }

      // we need to update our vaulting
      const vaultResponse = await processor.createVault(billing.customerId, {
        ...paymentFormValues,
        email: billing.email,
        paymentMethod: paymentMethod,
        country: getPaymentSafeCountryCode(paymentFormValues.country),
        phone: billing.payor?.phoneNumber,
        creditCardDetails: {
          ccnumber: paymentFormValues?.ccnumber,
          ccexp: paymentFormValues?.ccexp,
        } as any,
        cvv: paymentFormValues?.cvv,
        achDetails: paymentFormValues?.achDetails,
      } as any);
      if (!vaultResponse.success) {
        throw new ErrorUtil(vaultResponse.message, 400);
      }
      // Update billing account with PayNetWorx token information
      billing.vaulted = true;

      // Initialize paymentProcessorData if it doesn't exist
      if (!billing.paymentProcessorData) {
        billing.paymentProcessorData = {};
      }
      const name = processor.getProcessorName();
      billing.paymentProcessorData[name] = {
        ...vaultResponse.data, // since processors can return different data its safest to just store what we get back to use later.
      };
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
    billing.plan = selectedPlan._id;
    billing.isYearly = billingCycle === 'yearly';

    // For free plans, we might not need a nextBillingDate or set it far in the future
    if (isFree) {
      // For free plans, set billing date far in the future or undefined
      billing.nextBillingDate = undefined;
      billing.status = 'active'; // Set status to active for free plans
      billing.needsUpdate = false; // No need for update on free plans
    } else {
      // sets the nextBillingDate to the end of the trialing period or tommorow
      billing.nextBillingDate = billing.status === 'trialing' ? moment(billing.trialLength).toDate() : moment(new Date()).add(1, 'day').toDate();
      billing.status = 'active';
      billing.needsUpdate = false; // if it was true set by admin, this will flip it off
    }

    // finally set the processor correctly
    billing.processor = processor.getProcessorName();
    await billing.save();

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
      console.log(err);
      throw new ErrorUtil('Something went wrong', 400);
    }
  }
}
