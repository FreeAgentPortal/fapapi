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
      const billingProfile = await this.modelMap['billing'].findOne({ profileId });

      if (!billingProfile) {
        throw new Error('Billing profile not found');
      }

      const processor = this.getProcessor();
      
      // from the processor object on billing get the billing information that relates to that processor
      const processorInfo = billingProfile.paymentProcessorData[processor.getProcessorName() as any] || {};

      const processorResponse = await processor.processPayment({
        amount: data.amount,
        currency: data.currency || 'USD',
        customerId: billingProfile.customer,
        ...processorInfo,
      }) as any;

      console.log(processorResponse);
      if (!processorResponse.success) {
        throw new Error('Payment processing failed');
      }

      // now we need to create a receipt in the database for the transaction
      // const receipt = await this.modelMap['receipt'].create({
      //   profileId,
      //   amount: data.amount,
      //   currency: data.currency,
      //   processorResponse,
      // });

      return {};
    } catch (error) {
      console.error('Error processing transaction:', error);
      throw error;
    }
  };
}
