import { ProfileCreator } from '../../interface/ProfileCreator';
import TeamService from '../../modules/team/service/TeamService';

export class TeamProfileCreator implements ProfileCreator {
  async createProfile(userId: string, profileData: any): Promise<{ profileId: string }> {
    const teamService = new TeamService();
    const profile = await teamService.createProfile(userId);
    return { profileId: profile._id as string };
  }
}
