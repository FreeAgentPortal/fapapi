import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { HomeFeedService } from '../services/HomeFeed.service';
import { RestartFeedError } from '../util/homeCursor';

export class HomeFeedHandler {
  private service = new HomeFeedService();
  fetch = asyncHandler(async (req: Request, res: Response) => {
    try {
      res.json(await this.service.fetch(String((req as AuthenticatedRequest).user._id), req.query.limit, req.query.cursor));
    } catch (err) {
      if (err instanceof RestartFeedError) {
        res.status(400).json({ success: false, code: 'FEED_RESTART_REQUIRED', message: err.message });
        return;
      }
      throw err;
    }
  });
}
