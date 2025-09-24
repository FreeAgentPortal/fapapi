import { Response } from 'express';
import error from '../../../../middleware/error';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ViewHandler } from '../handlers/ViewHandler';
import { eventBus } from '../../../../lib/eventBus';

export default class ViewService {
  constructor(private readonly handler: ViewHandler = new ViewHandler()) {}

  public trackView = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.handler.recordAthleteView(req);
      if (results.isNewView) {
        eventBus.publish('athlete.view.recorded', {
          athleteId: req.params.id!,
          viewerId: req.user._id.toString(),
        });
      }
      return res.status(201).json({ success: true, payload: results });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });

  public getViewStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.handler.getAthleteViewStats({
        athleteId: req.params.id!,
        days: req.query.days,
      });
      return res.status(200).json({ success: true, payload: results });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
}
