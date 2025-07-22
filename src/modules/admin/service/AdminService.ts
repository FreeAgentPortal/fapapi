// services/AdminService.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDService } from '../../../utils/baseCRUD';
import { AdminProfileHandler } from '../handlers/AdminProfile.handler';
import AdminModel from '../model/AdminModel';
import error from '../../../middleware/error';
import { RolesConfig } from '../util/RolesConfig';

type AdminProfileInput = {
  user: string;
  role?: 'admin' | 'moderator' | 'developer' | 'superadmin';
  permissions?: string[];
};

export default class AdminService extends CRUDService {
  constructor() {
    super(AdminProfileHandler);
    this.queryKeys = ['permissions'];
    this.requiresAuth = {
      create: true,
      getResources: true,
      getResource: true,
      updateResource: true,
      removeResource: true,
    };
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
