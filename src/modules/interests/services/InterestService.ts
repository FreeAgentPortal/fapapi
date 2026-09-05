import { Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import logger from '../../../utils/logger';
import { InterestError } from '../InterestError';
import { InterestHandler } from '../handlers/InterestHandler';

export class InterestService {
  constructor(private readonly handler: InterestHandler = new InterestHandler()) {}

  public getQuota = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const quota = await this.handler.getQuota(this.getProfileId(req, 'athlete'));
      return res.status(200).json({ success: true, payload: quota });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  public expressInterest = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.expressInterest({
        athleteProfileId: this.getProfileId(req, 'athlete'),
        initiatedByUserId: req.user._id.toString(),
        teamId: req.body?.teamId,
        note: req.body?.note,
      });

      void eventBus
        .publish('athlete.interest.expressed', {
          interestId: result.interest._id.toString(),
          athleteProfileId: result.interest.athleteProfile.toString(),
          teamProfileId: result.interest.teamProfile.toString(),
          initiatedByUserId: result.interest.initiatedByUser.toString(),
        })
        .catch((err) => logger.error({ err, interestId: result.interest._id }, '[InterestService] Notification delivery failed.'));

      return res.status(201).json({ success: true, payload: result });
    } catch (err) {
      console.log(err);
      return this.handleError(err, req, res);
    }
  });

  public getMine = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getAthleteInterests(this.getProfileId(req, 'athlete'), this.pagination(req));
      return res.status(200).json({ success: true, payload: result.entries, metadata: result.metadata });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  public getMineStatuses = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const rawIds = typeof req.query.teamIds === 'string' ? req.query.teamIds : '';
      const teamIds = rawIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (!teamIds.length) throw new InterestError('INTEREST_FORBIDDEN', 'At least one team ID is required.', 400);

      const statuses = await this.handler.getAthleteTeamStatuses(this.getProfileId(req, 'athlete'), teamIds);
      return res.status(200).json({ success: true, payload: statuses });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  public getTeamInbox = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.getTeamInterests(
        this.getProfileId(req, 'team'),
        req.user._id.toString(),
        this.pagination(req),
        typeof req.query.status === 'string' ? req.query.status : undefined
      );
      return res.status(200).json({ success: true, payload: result.entries, metadata: result.metadata });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  public getTeamInterest = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const interest = await this.handler.getTeamInterest(req.params.interestId, this.getProfileId(req, 'team'), req.user._id.toString());
      return res.status(200).json({ success: true, payload: interest });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  public markViewed = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const interest = await this.handler.markViewed(req.params.interestId, this.getProfileId(req, 'team'), req.user._id.toString());
      return res.status(200).json({ success: true, payload: interest });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  public dismiss = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const interest = await this.handler.dismiss(req.params.interestId, this.getProfileId(req, 'team'), req.user._id.toString());
      return res.status(200).json({ success: true, payload: interest });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  public startConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.handler.startConversation({
        interestId: req.params.interestId,
        teamId: this.getProfileId(req, 'team'),
        userId: req.user._id.toString(),
        message: req.body?.message,
      });

      if (result.created) {
        void eventBus
          .publish('conversation.started', { conversation: result.conversation })
          .catch((err) => logger.error({ err, conversationId: result.conversation._id }, '[InterestService] Conversation-started notification failed.'));
        if (result.newMessage) {
          void eventBus
            .publish('conversation.message', { message: result.newMessage })
            .catch((err) => logger.error({ err, conversationId: result.conversation._id }, '[InterestService] Conversation-message notification failed.'));
        }
      }

      return res.status(result.created ? 201 : 200).json({
        success: true,
        payload: result.conversation,
        existing: !result.created,
      });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  });

  private getProfileId(req: AuthenticatedRequest, role: 'athlete' | 'team'): string {
    const profileId = req.user?.profileRefs?.[role];
    if (!profileId) throw new InterestError('INTEREST_FORBIDDEN', `A linked ${role} profile is required.`, 403);
    return profileId.toString();
  }

  private pagination(req: AuthenticatedRequest): { page: number; limit: number } {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
    return { page, limit };
  }

  private handleError(err: unknown, req: AuthenticatedRequest, res: Response): Response {
    if (err instanceof InterestError) {
      return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message, details: err.details });
    }
    logger.error({ err }, '[InterestService] Interest request failed.');
    return error(err, req, res);
  }
}
