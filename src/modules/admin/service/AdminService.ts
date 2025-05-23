// services/AdminService.ts
import AdminModel from '../model/AdminModel';

type AdminProfileInput = {
  user: string;
  role?: 'admin' | 'moderator' | 'developer' | 'superadmin';
  permissions?: string[];
};

export default class AdminService {
  static async createProfile({ user, role = 'admin', permissions = [] }: AdminProfileInput) {
    const profile = new AdminModel({
      user,
      role,
      permissions,
    });

    return await profile.save();
  }
}
