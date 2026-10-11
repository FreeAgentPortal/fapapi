import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { SponsorFeedService } from '../services/SponsorFeedService';

export class SponsorFeedHandler {
  private service = new SponsorFeedService();
  private user(req: Request): string {
    return String((req as AuthenticatedRequest).user._id);
  }
  getAd = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, payload: await this.service.getAd(req.params.id) });
  });
  saveAd = asyncHandler(async (req: Request, res: Response) => {
    if (Object.keys(req.files ?? {}).some((key) => key !== 'image') || Array.isArray(req.files?.image)) throw new ErrorUtil('Upload one creative using the image field', 400);
    res.json({ success: true, payload: await this.service.saveAd(req.params.id, req.body, this.user(req), req.files?.image) });
  });
  removeAd = asyncHandler(async (req: Request, res: Response) => {
    await this.service.removeAd(req.params.id, this.user(req));
    res.json({ success: true, payload: null });
  });
  recordEvent = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, payload: await this.service.recordEvent(req.body?.token, req.body?.type, this.user(req)) });
  });
  report = asyncHandler(async (req: Request, res: Response) => {
    if (req.query.sponsorId !== undefined && typeof req.query.sponsorId !== 'string') throw new ErrorUtil('Invalid sponsor ID', 400);
    res.json({ success: true, payload: await this.service.report(req.query.from, req.query.to, req.query.sponsorId as string | undefined) });
  });
}
