// services/profiles/AdminProfileCreator.ts
import { ProfileCreator } from '../../interface/ProfileCreator';
import AdminService from '../../modules/admin/service/AdminService';

export class AdminProfileCreator implements ProfileCreator {
  async createProfile(userId: string, profileData: any): Promise<{ profileId: string }>  {
    const adminProfile = await AdminService.createProfile({
      user: userId,
      role: 'developer',
      permissions: ['*'],
    });
    return { profileId: adminProfile._id.toString() };
  }
}