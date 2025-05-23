import { ProfileCreator } from '../../interface/ProfileCreator';
import TeamService from '../../modules/team/service/TeamService';

export class TeamProfileCreator implements ProfileCreator {
  async createProfile(userId: string): Promise<{ profileId: string }> {
    const profile = await TeamService.createProfile(userId);
    return { profileId: profile._id };
  }
}
