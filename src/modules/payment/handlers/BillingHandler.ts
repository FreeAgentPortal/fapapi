import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import BillingAccount from '../../auth/model/BillingAccount';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import { PaymentHandler } from './PaymentHandler';

export class BillingHandler {
  constructor(private readonly paymentHandler: PaymentHandler = new PaymentHandler()) {}
  async updateVault(req: AuthenticatedRequest): Promise<Boolean> {
    const { id } = req.params;
    const { paymentFormValues } = req.body;
    const processor = new PaymentProcessorFactory().chooseProcessor('pyre');
    // first step find the billing information from the provided profile id
    const billing = await BillingAccount.findOne({ profileId: id }).populate('payor');
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }

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
      paymentMethod: req.body.paymentMethod,
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
    billing.plan = req.body.selectedPlans[0]._id;

    await billing.save();

    return true;
  }

  /**
   * @description Fetch billing information for user from profile id
   */
  async getVault(id: string): Promise<any> {
    try {
      const billing = await BillingAccount.findOne({ profileId: id });
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
