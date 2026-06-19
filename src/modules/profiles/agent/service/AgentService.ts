import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import User from '../../../auth/model/User';
import { CRUDService } from '../../../../utils/baseCRUD';
import { IAgentProfile } from '../model/AgentProfile';
import { AgentProfileHandler } from '../handlers/AgentProfile.handler';
import asyncHandler from '../../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { Response } from 'express';
import error from '../../../../middleware/error';

export class AgentService extends CRUDService {
  constructor() {
    super(AgentProfileHandler);
    this.queryKeys = ['displayName', 'agencyName', 'email'];
  }

  async createProfile(userId: string, data: Partial<IAgentProfile>): Promise<IAgentProfile> {
    try {
      const user = await User.findById(userId).lean();
      const profileData = {
        user: userId,
        displayName: data.displayName || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || undefined,
        email: data.email || user?.email,
        contactNumber: data.contactNumber || user?.phoneNumber,
        ...data,
      };
      if (!profileData.displayName && !profileData.agencyName) {
        profileData.displayName = undefined;
      }
      return await this.handler.create(profileData);
    } catch (error) {
      console.error('[Profiles - Agent] Failed to create profile:', error);
      throw new ErrorUtil('Failed to create agent profile', 400);
    }
  }
  public profile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.handler.getProfile({ id: req.params.id });
      return res.status(201).json({ success: true, payload: results });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
