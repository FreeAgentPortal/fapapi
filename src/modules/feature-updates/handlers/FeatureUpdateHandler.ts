import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { FeatureUpdateService } from '../services/FeatureUpdateService';
import { inputObject } from '../utils/featureUpdateInput';

export class FeatureUpdateHandler {
  private service = new FeatureUpdateService();

  publicConfig = asyncHandler(async (req: Request, res: Response) => {
    // Do not let caches keep serving announcements after an admin disables them.
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, payload: await this.service.getPublicConfig(req.query.belongs_to) });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const { entries, ...metadata } = await this.service.list(req.query);
    res.json({ success: true, payload: entries, metadata });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, payload: await this.service.get(req.params.id) });
  });

  create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.status(201).json({ success: true, payload: await this.service.create(req.body, req.user?._id) });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, payload: await this.service.update(req.params.id, req.body, (req as AuthenticatedRequest).user?._id) });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const body = inputObject(req.body, ['revision']);
    await this.service.remove(req.params.id, body.revision);
    res.json({ success: true });
  });

  portals = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, payload: await this.service.getPortals() });
  });

  savePortalTitle = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, payload: await this.service.savePortalTitle(req.params.portal, req.body) });
  });
}
