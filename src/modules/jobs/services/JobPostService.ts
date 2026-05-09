import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import authenticateUser from '../../../utils/authenticateUser';
import { CRUDService } from '../../../utils/baseCRUD';
import JobPostHandler from '../handlers/JobPostHandler';

type JobPostUpdatePayload = Record<string, any>;

export default class JobPostService extends CRUDService {
  constructor() {
    super(JobPostHandler);
    this.queryKeys = ['title', 'department', 'description', 'requirements', 'preferredQualifications', 'location.city', 'location.state', 'location.country'];
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const teamId = this.requireTeamProfile(req.user);
      const data = req.body;

      const created = await this.handler.create({
        ...data,
        team: teamId,
        createdBy: req.user._id,
        status: data.status || 'draft',
      });

      return res.status(201).json({
        success: true,
        payload: created,
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const existing = await this.handler.fetch(req.params.id);

      if (!existing) {
        throw new ErrorUtil('Job post not found', 404);
      }

      const payload = req.body;

      if (Object.keys(payload).length === 0) {
        throw new ErrorUtil('No valid job post fields provided for update', 400);
      }

      let updated;

      if (Array.isArray(authReq.user?.role) && authReq.user.role.includes('admin')) {
        updated = await this.handler.update(req.params.id, payload);
      } else {
        const teamId = this.requireTeamProfile(authReq.user);

        if (String(existing.team) !== teamId) {
          throw new ErrorUtil('Forbidden: you do not own this job post', 403);
        }

        updated = await this.handler.updateOwned(req.params.id, teamId, payload);
      }

      if (!updated) {
        throw new ErrorUtil('Job post not found', 404);
      }

      return res.status(200).json({
        success: true,
        payload: updated,
      });
    } catch (err) {
      return error(err, req, res);
    }
  };

  public removeResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const existing = await this.handler.fetch(req.params.id);

      if (!existing) {
        throw new ErrorUtil('Job post not found', 404);
      }

      if (Array.isArray(authReq.user?.role) && authReq.user.role.includes('admin')) {
        await this.handler.delete(req.params.id);
      } else {
        const teamId = this.requireTeamProfile(authReq.user);

        if (String(existing.team) !== teamId) {
          throw new ErrorUtil('Forbidden: you do not own this job post', 403);
        }

        const deleted = await this.handler.deleteOwned(req.params.id, teamId);

        if (!deleted) {
          throw new ErrorUtil('Job post not found', 404);
        }
      }

      return res.status(200).json({
        success: true,
      });
    } catch (err) {
      return error(err, req, res);
    }
  };

  private requireTeamProfile(user: AuthenticatedRequest['user'] | null | undefined): string {
    if (!Array.isArray(user?.role) || !user.profileRefs?.team) {
      throw new ErrorUtil('Only team users can perform this action', 403);
    }

    return String(user!.profileRefs.team);
  }

  private canManageJob(user: any, jobTeamId: unknown): boolean {
    if (!user) {
      return false;
    }

    if (Array.isArray(user?.role) && user.role.includes('admin')) {
      return true;
    }

    if (!Array.isArray(user?.role) || !user.role.includes('team') || !user.profileRefs?.team) {
      return false;
    }

    return String(user.profileRefs.team) === String(jobTeamId);
  }
}
