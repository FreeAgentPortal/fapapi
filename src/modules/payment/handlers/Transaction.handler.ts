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

  public refundTransaction = async (transactionId: string, amount: number): Promise<any> => {
    try {
      // find the receipt for the transaction
      const receipt = await this.modelMap['receipt'].findById({ _id: transactionId });
      if (!receipt) {
        throw new Error('Transaction not found');
      }
      const processor = this.getProcessor();
      const billingInfo = await this.modelMap['billing'].findById(receipt.billingAccountId);
      if (!billingInfo) {
        throw new Error('Billing information not found');
      }

      // run the refund through the payment processor
      const results = (await processor.refundTransaction({
        transactionId,
        amount,
        customerId: billingInfo.customer,
        ...billingInfo.paymentProcessorData[processor.getProcessorName() as any],
      })) as any;

      console.log(results);
      if (!results.success) {
        throw new Error('Refund processing failed');
      }
      // update the receipt to reflect the refund
      const refundReceipt = await this.modelMap['receipt'].findOneAndUpdate(
        { transactionId },
        {
          $set: {
            status: 'refunded',
            amount: receipt.amount - amount,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

      return { success: true, data: refundReceipt };
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  };

  public voidTransaction = async (transactionId: string): Promise<any> => {
    try {
      // find the receipt for the transaction
      const receipt = await this.modelMap['receipt'].findById({ _id: transactionId });
      if (!receipt) {
        throw new Error('Transaction not found');
      }
      const processor = this.getProcessor();
      const billingInfo = await this.modelMap['billing'].findById(receipt.billingAccountId);
      if (!billingInfo) {
        throw new Error('Billing information not found');
      }
      // run the void through the payment processor
      const results = (await processor.voidTransaction({
        transactionId,
        customerId: billingInfo.customer,
        ...billingInfo.paymentProcessorData[processor.getProcessorName() as any],
      })) as any; 
      if (!results.success) {
        throw new Error('Void processing failed' + (results.message ? `: ${results.message}` : ''));
      }
      // update the receipt to reflect the void
      const voidReceipt = await this.modelMap['receipt'].findOneAndUpdate(
        { transactionId },
        {
          $set: {
            status: 'voided',
            // set amount to 0 since the transaction was voided
            amount: 0,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

      return { success: true, data: voidReceipt };
    } catch (error) {
      console.error('Error processing void:', error);
      throw error;
    }
  };
}
