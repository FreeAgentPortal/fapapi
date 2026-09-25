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
      const page = this.parsePage(req.query.pageNumber);
      const limit = this.parseLimit(req.query.pageLimit ?? req.query.limit);
      const [payload, totalCount] = await Promise.all([
        this.handler.getRecent(days, limit, page),
        this.handler.getRecentCount(days),
      ]);
      const pages = Math.ceil(totalCount / limit);

      return res.status(200).json({
        success: true,
        payload,
        metadata: {
          days,
          page,
          limit,
          pages,
          totalCount,
          prevPage: page > 1 ? page - 1 : null,
          nextPage: page < pages ? page + 1 : null,
        },
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  public userActivity = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      const days = this.parseDays(req.query.days);
      const page = this.parsePage(req.query.pageNumber);
      const limit = this.parseLimit(req.query.pageLimit ?? req.query.limit);
      const result = await this.handler.getUserActivity(req.params.userId, days, page, limit);
      const { totalCount, ...payload } = result;
      const pages = Math.ceil(totalCount / limit);

      return res.status(200).json({
        success: true,
        payload,
        metadata: {
          days,
          page,
          limit,
          pages,
          totalCount,
          prevPage: page > 1 ? page - 1 : null,
          nextPage: page < pages ? page + 1 : null,
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

  private parsePage(value: unknown): number {
    if (value === undefined) {
      return 1;
    }

    const rawValue = Array.isArray(value) ? value[0] : value;
    const page = Number(rawValue);

    if (!Number.isInteger(page) || page < 1) {
      throw new ErrorUtil('pageNumber must be a positive integer', 400);
    }

    return page;
  }
}
