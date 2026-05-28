import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { JobSchedulerCron } from '../cron/JobScheduler.cron';

export class JobSchedulerService {
  public triggerExpiration = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await JobSchedulerCron.triggerManualExpiration();
      return res.status(200).json({
        success: true,
        message: `Job expiration check completed. ${result.closed} job(s) closed.`,
        payload: result,
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  public getStatus = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const status = JobSchedulerCron.getStatus();
      return res.status(200).json({
        success: true,
        payload: status,
      });
    } catch (err) {
      return error(err, req, res);
    }
  });
}
