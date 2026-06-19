import { Response } from 'express';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import error from '../../../../middleware/error';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { AgentDashboardHandler } from '../handlers/AgentDashboard.handler';

export class AgentDashboardService {
  constructor(private readonly handler: AgentDashboardHandler = new AgentDashboardHandler()) {}

  public getSeatsCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getSeatsCard(this.requireAgentProfileRef(req));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getInvitesCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getInvitesCard(this.requireAgentProfileRef(req));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getViewsCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getViewsCard(this.requireAgentProfileRef(req), this.resolveDays(req.query.days));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public getInboxCard = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getInboxCard(this.requireAgentProfileRef(req), this.resolveDays(req.query.days));
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  private requireAgentProfileRef(req: AuthenticatedRequest): string {
    const profileId = req.user?.profileRefs?.agent;
    if (!profileId) {
      throw new ErrorUtil('Authenticated user does not have an agent profile.', 403);
    }
    return profileId;
  }

  private resolveDays(rawDays: unknown): number {
    if (rawDays === undefined) {
      return 30;
    }

    const normalized = Array.isArray(rawDays) ? rawDays[0] : rawDays;
    const parsedDays = Number(normalized);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      throw new ErrorUtil('days must be a positive number.', 400);
    }
    return parsedDays;
  }
}
