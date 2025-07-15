// services/AdminService.ts
import { CRUDService } from '../../../utils/baseCRUD';
import { AdminProfileHandler } from '../handlers/AdminProfile.handler';
import AdminModel from '../model/AdminModel';

type AdminProfileInput = {
  user: string;
  role?: 'admin' | 'moderator' | 'developer' | 'superadmin';
  permissions?: string[];
};

export default class AdminService extends CRUDService {
  constructor() {
    super(AdminProfileHandler);
    this.queryKeys = ['permissions'];
  }
  static async createProfile({ user, role = 'admin', permissions = [] }: AdminProfileInput) {
    const profile = new AdminModel({
      user,
      role,
      permissions,
    });

    return await profile.save();
  }
}
