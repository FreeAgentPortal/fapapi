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

  // Overload signatures
  createProfile(data: AthleteProfileInput): Promise<IAthlete>;
  createProfile(req: Request, res: Response): Promise<void>;

  // Unified implementation
  async createProfile(
    arg1: AthleteProfileInput | Request,
    arg2?: Response
  ): Promise<IAthlete | void> {
    if (isExpressRequest(arg1) && arg2) {
      // HTTP route version
      try {
        const data = arg1.body as AthleteProfileInput;
        const profile = await this.profileHandler.createProfile(data);
        return arg2.status(201).json(profile) as unknown as IAthlete;
      } catch (error: any) {
        return arg2.status(400).json({ error: error.message }) as unknown as void;
      }
    } else {
      // Internal service usage
      return await this.profileHandler.createProfile(arg1 as AthleteProfileInput);
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
