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
      return res.status(201).json({ message: 'billing updated', success: true, payload: results });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });
  public fetchBilling = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const results = await this.billingHandler.getVault(req.params.id);
      return res.status(201).json({ message: 'success', payload: results });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public createPaymentMethod = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.billingHandler.createPaymentMethod(req as any);
      return res.status(201).json({ message: 'payment method stored', success: true, payload: results });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public fetchPaymentMethod = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.billingHandler.fetchPaymentMethod(req as any);
      return res.status(200).json({ message: 'success', success: true, payload: results });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public removePaymentMethod = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.billingHandler.removePaymentMethod(req as any);
      return res.status(200).json({ message: 'payment method removed', success: true, payload: results });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public changePlan = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.billingHandler.changePlan(req as any);
      return res.status(200).json({ message: 'billing plan updated', success: true, payload: results });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public cancelAccount = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      await this.billingHandler.cancelAccount(req as any);
      return res.status(200).json({ message: 'Account cancelled', success: true });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  });

}
