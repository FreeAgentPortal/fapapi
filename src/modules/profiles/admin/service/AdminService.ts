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
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import {
  AdminProfileViewReportHandler,
  AdminProfileViewSubjectFilter,
  AdminProfileViewViewerFilter,
} from '../handlers/AdminProfileViewReport.handler';

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

  public getProfileViewReport = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const report = await new AdminProfileViewReportHandler().generateReport({
        days: this.parseIntegerQuery(req.query.days, 'days', 30, 90),
        subjectType: this.parseEnumQuery(req.query.subjectType, 'subjectType', ['all', 'athlete', 'professional'], 'all'),
        viewerType: this.parseEnumQuery(
          req.query.viewerType,
          'viewerType',
          ['all', 'team', 'scout', 'agent', 'athlete', 'professional', 'admin'],
          'team'
        ),
        page: this.parseIntegerQuery(req.query.pageNumber, 'pageNumber', 1),
        limit: this.parseIntegerQuery(req.query.pageLimit, 'pageLimit', 25, 100),
      });
      const { metadata, ...payload } = report;

      return res.status(200).json({
        message: 'Profile view report retrieved',
        success: true,
        payload,
        metadata,
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  private parseIntegerQuery(raw: unknown, name: string, defaultValue: number, maximum?: number): number {
    if (raw === undefined) return defaultValue;
    if (Array.isArray(raw) || typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      throw new ErrorUtil(`${name} must be a positive integer`, 400);
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
      throw new ErrorUtil(`${name} must be an integer between 1 and ${maximum ?? Number.MAX_SAFE_INTEGER}`, 400);
    }
    return value;
  }

  private parseEnumQuery<T extends string>(raw: unknown, name: string, values: readonly T[], defaultValue: T): T {
    if (raw === undefined) return defaultValue;
    if (Array.isArray(raw) || typeof raw !== 'string' || !values.includes(raw as T)) {
      throw new ErrorUtil(`${name} must be one of: ${values.join(', ')}`, 400);
    }
    return raw as T;
  }
}
