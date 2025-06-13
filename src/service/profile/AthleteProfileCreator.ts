// services/profiles/AthleteProfileCreator.ts
import { ProfileCreator } from '../../interface/ProfileCreator';
import AthleteService from '../../modules/athlete/service/AthleteService';

export class AthleteProfileCreator implements ProfileCreator {
  async createProfile(userId: string, profileData: any): Promise<{ profileId: string }> {
    const athleteService = new AthleteService();
    const profile = await athleteService.createProfile(userId, profileData);
    return { profileId: profile._id as unknown as string };
  }
}
