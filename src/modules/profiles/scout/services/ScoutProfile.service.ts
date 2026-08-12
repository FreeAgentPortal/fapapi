import { Response } from 'express';
import { CRUDService } from '../../../../utils/baseCRUD';
import { ScoutProfileHandler } from '../handlers/ScoutProfile.handler';
import { ScoutProfileActionsHandler } from '../handlers/ScoutProfileActions.handler';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';

const parsePositiveInteger = (value: unknown, name: string, defaultValue: number, maximum?: number): number => {
  if (value === undefined || value === '') return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ErrorUtil(`${name} must be a positive integer`, 400);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum !== undefined && parsed > maximum)) {
    throw new ErrorUtil(`${name} must be an integer between 1 and ${maximum ?? Number.MAX_SAFE_INTEGER}`, 400);
  }

  return parsed;
};

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

  public fetchFavoritedAthletes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.scoutProfileActionsHandler.fetchFavoritedAthletes(req.user.profileRefs['scout'] as any);
      return res.status(200).json({ success: true, payload: result });
    } catch (err) {
      console.error('[ScoutProfileService] Error fetching favorited athletes:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  public fetchScoutingQueue = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const scoutProfileId = req.user?.profileRefs?.scout;
    console.log(req.user);
    if (!scoutProfileId) {
      throw new ErrorUtil('Only scout users can access the scouting queue', 403);
    }

    const result = await this.scoutProfileActionsHandler.fetchScoutingQueue({
      page: parsePositiveInteger(req.query.pageNumber, 'pageNumber', 1),
      limit: parsePositiveInteger(req.query.pageLimit, 'pageLimit', 20, 50),
    });

    return res.status(200).json({ success: true, ...result });
  });
}
