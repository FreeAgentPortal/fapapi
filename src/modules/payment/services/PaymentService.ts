import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { BillingHandler } from '../handlers/BillingHandler';
import asyncHandler from '../../../middleware/asyncHandler';

export default class PaymentService {
  constructor(private readonly billingHandler: BillingHandler = new BillingHandler()) {}

  public updateBilling = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.billingHandler.updateVault(req as any);
      return res.status(201).json({ message: 'billing updated', success: true });
    } catch (err: any) {
      console.log(err);
      return error(err, req, res);
    }
  });
  public fetchBilling = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const results = await this.billingHandler.getVault(req.params.id);
      return res.status(201).json({ message: 'success', payload: results });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
 
}
