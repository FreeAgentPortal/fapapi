import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import asyncHandler from '../../../middleware/asyncHandler';
import { ReceiptHandler } from '../handlers/ReceiptHandler';
import { CRUDService } from '../../../utils/baseCRUD';

export default class ReceiptService extends CRUDService { 
  constructor() {
    super(ReceiptHandler);
  }

  public paymentStatistics = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const billingAccountId = req.params.billingAccountId;
      const results = await (this.handler as ReceiptHandler).paymentStatistics(billingAccountId);
      return res.status(200).json({ message: 'payment statistics retrieved', success: true, payload: results });
    } catch (err: any) {
      console.log(err);
      return error(err, req, res);
    } 
  });
}
