import { Request, Response } from 'express';
import { IAthlete } from '../models/AthleteModel';
import { AthleteProfileHandler, AthleteProfileInput } from '../handlers/AtheleteProfileHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';

// Type guard to check if input is an Express Request
function isExpressRequest(arg: any): arg is Request {
  return arg && typeof arg === 'object' && 'body' in arg;
}

export default class AthleteService {
  private profileHandler: AthleteProfileHandler;

  constructor() {
    this.profileHandler = new AthleteProfileHandler();
  }

  /**
   * Called internally during registration or profile bootstrapping.
   */
  async createProfile(data: AthleteProfileInput): Promise<IAthlete> {
    return await this.profileHandler.createProfile(data);
  }
  /**
   * Called from an HTTP route. Handles req/res and responds to client.
   */
  async createProfileFromRequest(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as AthleteProfileInput;
      const profile = await this.profileHandler.createProfile(data);
      res.status(201).json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  async updateProfile(req: Request, res: Response) {
    try {
      const results = await this.profileHandler.updateProfile(req as AuthenticatedRequest);
      return res.status(200).json(results);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
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

  async getProfile(req: Request, res: Response) {
    try {
      const profile = await this.profileHandler.getProfile(req);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      return res.status(200).json(profile);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
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
}
