import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthActivityAnalyticsHandler } from '../handlers/AuthActivityAnalyticsHandler';

const ALLOWED_DAYS = [7, 30, 60];

export class AuthActivityAnalyticsService {
  private readonly handler = new AuthActivityAnalyticsHandler();

  public summary = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const days = this.parseDays(req.query.days);
      const payload = await this.handler.getSummary(days);

      return res.status(200).json({
        success: true,
        payload,
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  public recent = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const days = this.parseDays(req.query.days);
      const limit = this.parseLimit(req.query.limit);
      const payload = await this.handler.getRecent(days, limit);

      return res.status(200).json({
        success: true,
        payload,
        metadata: {
          days,
          limit,
          count: payload.length,
        },
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  private parseDays(value: unknown): number {
    if (value === undefined) {
      return 7;
    }

    const rawValue = Array.isArray(value) ? value[0] : value;
    const days = Number(rawValue);

    if (!ALLOWED_DAYS.includes(days)) {
      throw new ErrorUtil('days must be one of: 7, 30, 60', 400);
    }

    return days;
  }

  private parseLimit(value: unknown): number {
    if (value === undefined) {
      return 25;
    }

    const rawValue = Array.isArray(value) ? value[0] : value;
    const limit = Number(rawValue);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ErrorUtil('limit must be an integer between 1 and 100', 400);
    }

    return limit;
  }
}
