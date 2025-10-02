import { Response } from 'express';
import { eventBus } from '../../../../lib/eventBus';
import error from '../../../../middleware/error';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ProfileActionsHandler } from '../handlers/ProfileActionsHandler';

export default class ProfileService {
  constructor(private readonly handler: ProfileActionsHandler = new ProfileActionsHandler()) {}

  public profile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.handler.getProfile({ id: req.params.id });
      return res.status(201).json({ success: true, payload: results });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public populateFromEspn = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.handler.populateFromEspn(req.params.playerid);
      eventBus.publish('athlete.profilePopulated', { playerid: req.params.playerid, profileDetails: results });
      return res.status(201).json({ success: true, payload: results });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
