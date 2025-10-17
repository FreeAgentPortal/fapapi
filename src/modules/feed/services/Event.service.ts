import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { CRUDService } from '../../../utils/baseCRUD';
import { EventHandler } from '../handlers/Event.handler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';

export class EventService extends CRUDService {
  constructor() {
    super(EventHandler);
  }

  public getEventsStatsByTeam = asyncHandler(async (req: AuthenticatedRequest | Request, res: Response) => {
    try {
      const teamId = req.params.teamId;
      const stats = await this.handler.getEventStatistics(teamId);
      res.json(stats);
    } catch (err) {
      console.error(err);
      error(err, req, res);
    }
  });
}
