import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDHandler } from '../../../utils/baseCRUD';
import BillingAccount from '../../auth/model/BillingAccount';
import PaymentProcessorFactory from '../factory/PaymentProcessorFactory';
import Receipt, { ReceiptType } from '../models/Receipt';

export class ReceiptHandler extends CRUDHandler<ReceiptType> {
  constructor() {
    super(Receipt);
  }

  /**
   * Generate Payment Statistics on a single billing account, including total receipts,
   * total amount paid, total refunds, and total failed payments and last successful payment date.
   * @param billingAccountId - The ID of the billing account to generate statistics for.
   * @returns An object containing the payment statistics.
   */
  async paymentStatistics(userId: string): Promise<any> {
    try {
      const receipts = await this.Schema.find({ userId });
      const totalReceipts = receipts.length;
      // total amount paid from successful payments
      const totalAmountPaid = receipts
        .filter((r) => r.status === 'success' || r.status === 'succeeded')
        .reduce((sum, r) => sum + r.amount, 0);
      // total refunds
      const totalRefunds = receipts.filter((r) => r.status === 'refunded').length;
      const totalFailedPayments = receipts.filter((r) => r.status === 'failed').length;
      const lastSuccessfulPayment = receipts
        .filter((r) => r.status === 'success' || r.status === 'succeeded')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      return {
        totalReceipts,
        totalAmountPaid,
        totalRefunds,
        totalFailedPayments,
        lastSuccessfulPaymentDate: lastSuccessfulPayment ? lastSuccessfulPayment.createdAt : null,
      };
    } catch (error: any) {
      throw new ErrorUtil(`Failed to generate payment statistics: ${error.message}`, 400);
    }
  }
}
