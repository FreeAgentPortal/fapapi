// services/profiles/AthleteProfileCreator.ts
import { ProfileCreator } from '../../interface/ProfileCreator';
import AthleteService from '../../modules/athlete/service/AthleteService';

export class AthleteProfileCreator implements ProfileCreator {
  async createProfile(userId: string, profileData: any): Promise<{ profileId: string }> {
    console.log(`called AthleteProfileCreator.createProfile with userId: ${userId} and profileData:`, profileData);
    const athleteService = new AthleteService();
    const profile = await athleteService.createProfile(userId, profileData);
    console.log(`Created athlete profile for userId: ${userId}, profileId: ${profile._id}`);

    return { profileId: profile._id as string };
  }
}
