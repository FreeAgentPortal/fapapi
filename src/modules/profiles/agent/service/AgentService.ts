import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import User from '../../../auth/model/User';
import { CRUDService } from '../../../../utils/baseCRUD';
import { IAgentProfile } from '../model/AgentProfile';
import { AgentProfileHandler } from '../handlers/AgentProfile.handler';

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
}
