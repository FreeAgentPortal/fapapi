import { Request, Response } from 'express';
import TeamProfileHandler from '../handlers/ProfileHandler';
import { eventBus } from '../../../lib/eventBus';
import { ITeamProfile } from '../model/TeamModel';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import AuthenticationHandler from '../handlers/AuthenticationHandler';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import error from '../../../middleware/error';
import { CRUDService } from '../../../utils/baseCRUD';
import asyncHandler from '../../../middleware/asyncHandler';

export default class TeamService extends CRUDService {
  constructor(private readonly authHandler: AuthenticationHandler = new AuthenticationHandler()) {
    super(TeamProfileHandler);
    this.requiresAuth = {
      updateResource: true,
      create: true,
    };
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

  /**
   * Called internally during registration or profile bootstrapping.
   */
  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const profile = await this.handler.createProfile(req.body);
      return res.status(201).json(profile);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  });

  /**
   * Called from an HTTP route. Handles req/res and responds to client.
   */
  async createProfileFromRequest(req: Request, res: Response) {
    try {
      const data = req.body as any; // Adjust type as needed
      const profile = await this.handler.createProfile(data);
      return res.status(201).json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
