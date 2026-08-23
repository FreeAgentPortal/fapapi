// services/AdminService.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { CRUDService } from '../../../../utils/baseCRUD';
import { AdminProfileHandler } from '../handlers/AdminProfile.handler';
import AdminModel from '../model/AdminModel';
import error from '../../../../middleware/error';
import { RolesConfig } from '../../../../utils/RolesConfig';
import asyncHandler from '../../../../middleware/asyncHandler';
import { AgentManagementReportHandler } from '../handlers/AgentManagementReport.handler';

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

  public getAgentManagementReport = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const report = await new AgentManagementReportHandler().generateReport();

      return res.status(200).json({
        message: 'Agent management report retrieved',
        success: true,
        payload: report,
      });
    } catch (err) {
      return error(err, req, res);
    }
  });
}
