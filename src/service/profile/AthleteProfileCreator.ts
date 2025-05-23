// services/profiles/AthleteProfileCreator.ts

import { ProfileCreator } from '../../interface/ProfileCreator';
import AthleteService from '../../modules/athlete/service/AthleteService';

export class AthleteProfileCreator implements ProfileCreator {
  async createProfile(userId: string): Promise<{ profileId: string }> {
    const profile = await AthleteService.createProfile(userId);
    return { profileId: profile._id };
  }
}
