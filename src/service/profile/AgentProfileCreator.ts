import { ProfileCreator } from '../../interface/ProfileCreator';
import { AgentService } from '../../modules/profiles/agent/service/AgentService';

export class AgentProfileCreator implements ProfileCreator {
  async createProfile(userId: string, profileData: any): Promise<{ profileId: string }> {
    const agentService = new AgentService();
    const profile = await agentService.createProfile(userId, profileData);
    return { profileId: profile._id.toString() };
  }
}
