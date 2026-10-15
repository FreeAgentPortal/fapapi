import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { ScoutReportWorkflowService } from '../services/ScoutReportWorkflow.service';
import { actorId, pagination } from '../utils/portfolioInput';

export class ScoutReportHandler {
  private reports = new ScoutReportWorkflowService();
  private handle(work: (req: AuthenticatedRequest, userId: string) => Promise<unknown>) {
    return asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      req.body ??= {};
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ success: true, payload: await work(req, actorId(req.user?._id)) });
    });
  }
  list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const p = pagination(req.query);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, ...await this.reports.list(actorId(req.user?._id), req.query, p.page, p.limit) });
  });
  get = this.handle((req, user) => this.reports.get(user, req.params.id as string));
  create = this.handle((req, user) => this.reports.create(user, req.body));
  update = this.handle((req, user) => this.reports.update(user, req.params.id as string, req.body));
  remove = this.handle((req, user) => this.reports.remove(user, req.params.id as string));
  decide = this.handle((req, user) => this.reports.decide(user, req.params.id as string, req.body));
}
