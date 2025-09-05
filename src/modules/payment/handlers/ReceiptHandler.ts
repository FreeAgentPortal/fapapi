import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import BillingAccount from '../../auth/model/BillingAccount';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';

export class ReceiptHandler {
  constructor() {}

  async fetchReceipts(req: AuthenticatedRequest): Promise<any> {
    // we need to fetch the billing information for the profile id
    const { id } = req.params;
    const billing = await BillingAccount.findOne({ profileId: id }).populate('payor');
    if (!billing) {
      throw new ErrorUtil('Could not find billing information', 404);
    }
    // instantiate the payment processor factory using the billing processor to choose the processor
    const processor = new PaymentProcessorFactory().chooseProcessor(billing.processor || 'paynetworx');
    // fetch the receipts from the processor
    const receipts = await processor.fetchTransactions(billing.customerId);
    if (!receipts.success) {
      throw new ErrorUtil(receipts.message, 400);
    }
    return receipts.payload.data;
  }
}
