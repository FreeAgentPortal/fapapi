import { NextFunction, Response } from 'express';
import asyncHandler from '../../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import TalentSearchService from '../service/TalentSearch.service';
import { parseTalentSearchQuery } from '../utils/talentSearchQuery';

export default class TalentSearchHandler {
  constructor(private readonly service: TalentSearchService = new TalentSearchService()) {}

  public authorizeTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    res.locals.teamProfileId = await this.service.authorizeTeam(req.user);
    next();
  });

  public search = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const options = parseTalentSearchQuery(req.query);
    const result = await this.service.search(options);

    return res.status(200).json({
      success: true,
      ...result,
    });
  });
}

