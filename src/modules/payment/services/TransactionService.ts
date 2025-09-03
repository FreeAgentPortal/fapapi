import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import TransactionHandler from '../handlers/Transaction.handler';

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
}
