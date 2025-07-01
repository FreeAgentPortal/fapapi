import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import { ReceiptHandler } from '../handlers/ReceiptHandler';

export default class ReceiptService {
  constructor(private readonly receiptHandler: ReceiptHandler = new ReceiptHandler()) {}

  public fetchReceipts = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const receipts = await this.receiptHandler.fetchReceipts(req);
      return res.status(201).json({ message: 'billing updated', success: true, payload: receipts });
    } catch (err: any) {
      console.log(err);
      return error(err, req, res);
    }
  });
}
