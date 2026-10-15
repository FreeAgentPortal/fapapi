import { Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { PortfolioAssetService } from '../../scout/services/PortfolioAsset.service';
import { actorId, pagination } from '../../scout/utils/portfolioInput';

export class PortfolioUploadHandler {
  private service = new PortfolioAssetService();
  private handle(work: (req: AuthenticatedRequest, userId: string) => Promise<unknown>) {
    return asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      req.body ??= {};
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ success: true, payload: await work(req, actorId(req.user?._id)) });
    });
  }
  list = this.handle((req, user) => { const p = pagination(req.query); return this.service.list(user, p.page, p.limit); });
  reserve = this.handle((req, user) => this.service.reserve(user, req.body));
  upload = this.handle((req, user) => this.service.upload(user, req.params.assetId, req.body));
  download = this.handle((req, user) => this.service.download(user, req.params.assetId, req.query.submissionId as string | undefined));
  remove = this.handle((req, user) => this.service.remove(user, req.params.assetId));
}
