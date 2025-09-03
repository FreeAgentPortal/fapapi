import { ModelKey, ModelMap } from '../../../utils/ModelMap';
import PaymentProcessor from '../classes/PaymentProcess';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';

export default class TransactionHandler {
  private processor: PaymentProcessor | null = null;
  private readonly modelMap: Record<ModelKey, any>;

  constructor() {
    this.modelMap = ModelMap;
  }

  private getProcessor(): PaymentProcessor {
    if (!this.processor) {
      this.processor = new PaymentProcessorFactory().chooseProcessor('paynetworx');
    }
    return this.processor;
  }

  public processTransaction = async (profileId: string, data: any): Promise<any> => {
    try {
      // first we need to find the billing profile of the user we are running a transaction on
      const billingProfile = await this.modelMap['billing'].findOne({ profileId }).populate('profileId');

      if (!billingProfile) {
        throw new Error('Billing profile not found');
      }

      const processor = this.getProcessor();

      // from the processor object on billing get the billing information that relates to that processor
      const processorInfo = billingProfile.paymentProcessorData[processor.getProcessorName() as any] || {};

      const processorResponse = (await processor.processPayment({
        amount: data.amount,
        currency: data.currency || 'USD',
        customerId: billingProfile.customer,
        ...processorInfo,
      })) as any;

      if (!processorResponse.success) {
        throw new Error('Payment processing failed');
      }

      // now we need to create a receipt in the database for the transaction
      const receipt = await this.modelMap['receipt'].create({
        profileId,
        transactionId: processorResponse.data.TransactionID,
        billingAccountId: billingProfile._id,
        userId: billingProfile.profileId.userId,
        status: 'success',
        type: 'payment',
        amount: data.amount,
        currency: data.currency,
        processor: {
          name: processor.getProcessorName(),
          transactionId: processorResponse.data.TransactionID,
          response: processorResponse.data.ResponseText,
        },
        customer: {
          id: billingProfile.customer,
          email: billingProfile.email,
          name: `${billingProfile.firstName} ${billingProfile.lastName}`,
          phone: billingProfile.phone,
        },
        transactionDate: new Date().toISOString(),
      });

      return {
        success: true,
        data: receipt,
      };
    } catch (error) {
      console.error('Error processing transaction:', error);
      throw error;
    }
  };
}
