import { Request, Response } from 'express';
import TeamProfileHandler from '../handlers/ProfileHandler';
import { eventBus } from '../../../../lib/eventBus';
import { ITeamProfile } from '../model/TeamModel';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import AuthenticationHandler from '../handlers/AuthenticationHandler';
import { AdvFilters } from '../../../../utils/advFilter/AdvFilters';
import error from '../../../../middleware/error';
import { CRUDService } from '../../../../utils/baseCRUD';
import asyncHandler from '../../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';

export default class TeamService extends CRUDService {
  constructor(private readonly authHandler: AuthenticationHandler = new AuthenticationHandler()) {
    super(TeamProfileHandler);
    this.requiresAuth = {
      updateResource: true,
      create: true,
    };
    this.queryKeys = ['name', 'description', 'tags'];
  }
  public checkResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      console.log(req);
      const exists = await this.authHandler.checkResourceExists(req);
      return res.status(200).json({
        exists,
      });
    } catch (err: any) {
      console.log(err);
      return res.status(500).json({ error: err.message });
    }
  };
  public createInternal = async (userId: string, data: any) => {
    try {
      return await this.handler.create(data);
    } catch (error: any) {
      console.error('Error creating team profile:', error);
      throw new ErrorUtil('Failed to create team profile', 400);
    }
  };
}
