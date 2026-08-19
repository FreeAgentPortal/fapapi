import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { SubscriptionRevenueReportHandler } from '../handlers/SubscriptionRevenueReport.handler';
import { UnmatchedStripeChargeHandler } from '../handlers/UnmatchedStripeCharge.handler';
import { StripeReceiptRecoveryHandler } from '../handlers/StripeReceiptRecovery.handler';
import { YearlySubscriptionRevenueHandler } from '../handlers/YearlySubscriptionRevenue.handler';

export default class SubscriptionRevenueReportService {
  public getReport = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const report = await new SubscriptionRevenueReportHandler().generateReport();
      return res.status(200).json({
        message: 'Subscription revenue report retrieved',
        success: true,
        payload: report,
      });
    } catch (err: any) {
      return error(err, req, res);
    }
  });

  public getYearlyReport = asyncHandler(async (
    req: Request & AuthenticatedRequest,
    res: Response
  ): Promise<Response> => {
    try {
      const report = await new YearlySubscriptionRevenueHandler().generateBaseline();
      return res.status(200).json({
        message: 'Yearly subscription revenue report retrieved',
        success: true,
        payload: report,
      });
    } catch (err: any) {
      return error(err, req, res);
    }
  });

  public getYearlyScenario = asyncHandler(async (
    req: Request & AuthenticatedRequest,
    res: Response
  ): Promise<Response> => {
    try {
      const report = await new YearlySubscriptionRevenueHandler().generateScenario(
        req.body?.acquisitions
      );
      return res.status(200).json({
        message: 'Yearly subscription revenue scenario generated',
        success: true,
        payload: report,
      });
    } catch (err: any) {
      return error(err, req, res);
    }
  });

  public getUnmatchedCharges = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const report = await new UnmatchedStripeChargeHandler().getUnmatchedCharges({
        month: typeof req.query.month === 'string' ? req.query.month : undefined,
        limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
        startingAfter: typeof req.query.startingAfter === 'string' ? req.query.startingAfter : undefined,
        customerId: typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
      });
      return res.status(200).json({
        message: 'Unmatched Stripe charges retrieved',
        success: true,
        payload: report,
      });
    } catch (err: any) {
      return error(err, req, res);
    }
  });

  public recoverStripeReceipt = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await new StripeReceiptRecoveryHandler().recoverReceipt(
        req.body?.stripeId,
        String(req.user._id)
      );
      return res.status(result.created ? 201 : 200).json({
        message: result.message,
        success: true,
        payload: result,
      });
    } catch (err: any) {
      return error(err, req, res);
    }
  });
}
