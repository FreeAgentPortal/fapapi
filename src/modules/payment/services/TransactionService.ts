import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import TransactionHandler from '../handlers/Transaction.handler';
import PaymentProcessingHandler from '../handlers/PaymentProcessing.handler';

export default class TransactionService {
  constructor(private readonly transactionHandler: TransactionHandler = new TransactionHandler()) {}

  public processTransaction = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.transactionHandler.processTransaction(req.params.id as any, req.body);
      return res.status(201).json({ message: 'transaction processed', success: true });
    } catch (err: any) {
      console.log(err);
      return error(err, req, res);
    }
  });
  public refundTransaction = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.transactionHandler.refundTransaction(req.params.id as any, req.body.amount);
      return res.status(201).json({ message: 'transaction refunded', success: true, data: results.data });
    } catch (err: any) {
      console.log(err);
      return error(err, req, res);
    }
  });
  public voidTransaction = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.transactionHandler.voidTransaction(req.params.id as any);
      return res.status(201).json({ message: 'transaction voided', success: true, data: results.data });
    } catch (err: any) {
      console.log(err);
      return error(err, req, res);
    }
  });

  public triggerScheduledPayments = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      console.log(`[TransactionService] Manual payment processing trigger initiated by user ${req.user?.id}`);
      
      const result = await PaymentProcessingHandler.processScheduledPayments();
      
      if (result.success) {
        return res.status(200).json({
          message: 'Scheduled payments processing completed',
          success: true,
          data: {
            total: result.results?.total || 0,
            successful: result.results?.successful || 0,
            failed: result.results?.failed || 0,
            errors: result.results?.errors || []
          }
        });
      } else {
        return res.status(500).json({
          message: 'Scheduled payments processing failed',
          success: false,
          error: result.message
        });
      }
    } catch (err: any) {
      console.error('[TransactionService] Error in manual payment processing trigger:', err);
      return error(err, req, res);
    }
  });
}
