import crypto from 'crypto';
import { Response } from 'express';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import error from '../../../../middleware/error';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { ManagedAthleteIdentity, ManagedAthleteService } from './ManagedAthlete.service';

export class ManagedAthleteHandler {
  constructor(private readonly service = new ManagedAthleteService()) {}

  getWorkspace = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const payload = await this.service.getWorkspace(this.getIdentity(req), req.params.athleteId);
      return res.status(200).json({ success: true, payload });
    } catch (err) {
      return error(err, req, res);
    }
  });

  updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const payload = await this.service.updateProfile(this.getIdentity(req), req.params.athleteId, req.body);
      return res.status(200).json({ success: true, payload });
    } catch (err) {
      return error(err, req, res);
    }
  });

  getResume = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const payload = await this.service.getResume(this.getIdentity(req), req.params.athleteId);
      return res.status(200).json({ success: true, payload });
    } catch (err) {
      return error(err, req, res);
    }
  });

  createResume = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const payload = await this.service.createResume(this.getIdentity(req), req.params.athleteId, req.body);
      return res.status(200).json({ success: true, payload });
    } catch (err) {
      return error(err, req, res);
    }
  });

  updateResumeVisibility = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
      try {
        const payload = await this.service.updateResumeVisibility(
          this.getIdentity(req),
          req.params.athleteId,
          req.params.resumeId,
          req.body
        );
        return res.status(200).json({ success: true, payload });
      } catch (err) {
        return error(err, req, res);
      }
    }
  );

  createResumeItem = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const payload = await this.service.createResumeItem(
        this.getIdentity(req),
        req.params.athleteId,
        req.params.section,
        req.body
      );
      return res.status(201).json({ success: true, payload });
    } catch (err) {
      return error(err, req, res);
    }
  });

  updateResumeItem = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const payload = await this.service.updateResumeItem(
        this.getIdentity(req),
        req.params.athleteId,
        req.params.section,
        req.params.itemId,
        req.body
      );
      return res.status(200).json({ success: true, payload });
    } catch (err) {
      return error(err, req, res);
    }
  });

  deleteResumeItem = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const payload = await this.service.deleteResumeItem(
        this.getIdentity(req),
        req.params.athleteId,
        req.params.section,
        req.params.resumeId,
        req.params.itemId
      );
      return res.status(200).json({ success: true, payload });
    } catch (err) {
      return error(err, req, res);
    }
  });

  rejectQAMutation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      this.getIdentity(req);
      throw new ErrorUtil('Agents cannot modify an athlete’s personal resume Q&A.', 403);
    } catch (err) {
      return error(err, req, res);
    }
  });

  private getIdentity(req: AuthenticatedRequest): ManagedAthleteIdentity {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      throw new ErrorUtil('Bearer authentication is required.', 401);
    }

    const actorUserId = req.user?._id?.toString();
    if (!actorUserId) {
      throw new ErrorUtil('Authenticated user is unavailable.', 401);
    }

    const agentProfileId = req.user?.profileRefs?.agent;
    if (!agentProfileId) {
      throw new ErrorUtil('Authenticated user does not have an agent profile.', 403);
    }

    const suppliedRequestId = req.header('x-request-id')?.trim();
    return {
      actorUserId,
      agentProfileId,
      requestId:
        suppliedRequestId && suppliedRequestId.length <= 200
          ? suppliedRequestId
          : crypto.randomUUID(),
    };
  }
}
