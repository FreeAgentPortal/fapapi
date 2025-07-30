import { Response } from 'express';
import { CRUDService } from '../../../../utils/baseCRUD';
import { ScoutProfileHandler } from '../handlers/ScoutProfile.handler';
import { ScoutProfileActionsHandler } from '../handlers/ScoutProfileActions.handler';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import asyncHandler from '../../../../middleware/asyncHandler';

export class ScoutProfileService extends CRUDService {
  constructor(private readonly scoutProfileActionsHandler: ScoutProfileActionsHandler = new ScoutProfileActionsHandler()) {
    super(ScoutProfileHandler);
  }

  public toggleFavoriteAthlete = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { athleteId } = req.params;
      const result = await this.scoutProfileActionsHandler.toggleFavoriteAthlete(req.user.profileRefs['scout'] as any, athleteId);
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error('[ScoutProfileService] Error toggling favorite athlete:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}
