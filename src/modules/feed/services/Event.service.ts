import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { CRUDService } from '../../../utils/baseCRUD';
import { EventHandler } from '../handlers/Event.handler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { ActivityClient } from '../util/ActivityClient';
import { EventDocument } from '../model/Event.model';
import { mapEventCreated } from '../util/activityMapper';

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

  protected async afterCreate(doc: EventDocument): Promise<void> {
    try {
      // only publish activity for active events
      if (doc.status === 'active') {
        await ActivityClient.publish(
          mapEventCreated({
            eventId: doc._id.toString(),
            teamId: doc.teamProfileId as unknown as string,
            sport: doc.sport,
            title: doc.title,
            kind: doc.type,
            startsAt: doc.startsAt,
            // for thumbUrl, we could use the media array, filter out all results that are
            // not images, and pick the first one as a thumbnail
            thumbUrl: doc.media?.find((m) => m.kind === 'image')?.url,
          })
        );
      }
    } catch (error) {
      console.error('[EventService]: Error publishing activity:', error);
    }
  }
}
