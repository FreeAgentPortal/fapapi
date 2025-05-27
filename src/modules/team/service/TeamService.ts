import { Request, Response } from 'express';
import TeamProfileHandler from '../handlers/ProfileHandler';
import { eventBus } from '../../../lib/eventBus';
import { ITeamProfile } from '../model/TeamModel';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
// Type guard to check if input is an Express Request
function isExpressRequest(arg: any): arg is Request {
  return arg && typeof arg === 'object' && 'body' in arg;
}
export default class TeamService {
  private profileHandler: TeamProfileHandler;

  constructor() {
    this.profileHandler = new TeamProfileHandler();
  }

  /**
   * Called internally during registration or profile bootstrapping.
   */
  async createProfile(data: any): Promise<ITeamProfile> {
    return await this.profileHandler.createProfile(data);
  }
  /**
   * Called from an HTTP route. Handles req/res and responds to client.
   */
  async createProfileFromRequest(req: Request, res: Response) {
    try {
      const data = req.body as any; // Adjust type as needed
      const profile = await this.profileHandler.createProfile(data);
      return res.status(201).json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const profile = await this.profileHandler.getProfileById(req.params.id);
      return res.status(200).json(profile);
    } catch (err: any) {
      return res.status(404).json({ error: 'Team profile not found' });
    }
  }
  async getProfiles(req: Request, res: Response) {
    try {
      const profiles = await this.profileHandler.getAllProfiles(req);
      return res.status(200).json(profiles);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const results = await this.profileHandler.updateProfile(req as AuthenticatedRequest);
      return res.status(200).json(results);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  async deleteProfile(req: Request, res: Response) {
    try {
      await this.profileHandler.deleteProfile(req as AuthenticatedRequest);
      return res.status(204).json({ success: true, message: 'Profile deleted successfully' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
