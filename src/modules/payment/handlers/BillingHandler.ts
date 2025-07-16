import moment from 'moment';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import BillingAccount from '../../auth/model/BillingAccount';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import { PaymentHandler } from './PaymentHandler';

export class BillingHandler {
  constructor(private readonly paymentHandler: PaymentHandler = new PaymentHandler()) {}
  async updateVault(req: AuthenticatedRequest): Promise<Boolean> {
    const { id } = req.params;
    const { paymentFormValues, selectedPlans, billingCycle, paymentMethod } = req.body;

    // first step find the billing information from the provided profile id
    const billing = await BillingAccount.findOne({ profileId: id }).populate('payor');
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }

    // Check if the selected plan is free
    const selectedPlan = selectedPlans[0];
    const isFree = selectedPlan.price === 0;

    // Handle paid plans - require payment processing
    if (!isFree) {
      const processor = new PaymentProcessorFactory().chooseProcessor('pyre');

      // if we dont have a customerId on billing object we need to create that first
      if (!billing.customerId) {
        const customer = await this.paymentHandler.createCustomer(req.user);
        // update the billing object with the customerId
        billing.customerId = customer.payload._id;
        billing.payor = req.user;
      }

      // we need to update our vaulting
      const vaultResponse = await processor.createVault(billing.customerId, {
        first_name: paymentFormValues.firstName,
        last_name: paymentFormValues.lastName,
        email: paymentFormValues.email,
        paymentMethod: paymentMethod,
        address1: paymentFormValues.address1,
        address2: paymentFormValues.address2,
        city: paymentFormValues.city,
        state: paymentFormValues.state,
        zip: paymentFormValues.zip,
        country: paymentFormValues.country,
        phone: billing.payor.phoneNumber,
        creditCardDetails: { ccnumber: paymentFormValues.ccnumber, ccexp: paymentFormValues.ccexp },
        achDetails: paymentFormValues.achDetails,
      });

      if (!vaultResponse.success) {
        throw new ErrorUtil(vaultResponse.message, 400);
      }

      // update the billing object that we have a vault
      billing.vaulted = true;
    } else {
      // Handle free plans - no payment processing required
      if (!billing.payor) {
        billing.payor = req.user;
      }

      // For free plans, we don't need vaulting or customer creation
      billing.vaulted = false;
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
    }

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
      const { payload } = await this.paymentHandler.fetchCustomer(billing.customerId);
      return {
        ...billing.toObject(),
        billingDetails: payload.vault,
      };
    } catch (err) {
      console.log(err);
      throw new ErrorUtil('Something went wrong', 400);
    }
  }
}
