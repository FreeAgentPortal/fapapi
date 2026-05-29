import mongoose from 'mongoose';
import { ProfileCreator } from '../../interface/ProfileCreator';

export class ProfessionalProfileCreator implements ProfileCreator {
  async createProfile(userId: string, profileData: any): Promise<{ profileId: string }> {
    const ProfessionalProfile = mongoose.model('ProfessionalProfile');
    const profile = await ProfessionalProfile.create({
      user: userId,
      ...profileData,
    });

    return { profileId: profile._id.toString() };
  }
}
