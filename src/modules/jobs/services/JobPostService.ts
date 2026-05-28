import mongoose from 'mongoose';
import { Request, Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import authenticateUser from '../../../utils/authenticateUser';
import { CRUDService } from '../../../utils/baseCRUD';
import JobPostHandler from '../handlers/JobPostHandler';
import JobPostStatsHandler from '../handlers/JobPostStats.handler';
import ApplicationProfileHandler from '../handlers/ApplicationProfile.handler';
import { ProfessionalProfileModel } from '../../profiles/professional/model/ProfessionalProfile';
import { ResumeProfile } from '../../profiles/resume/models/ResumeProfile';
import JobApplicationModel from '../models/JobApplication';
import { JobPostModel } from '../models/JobPost';
import { buildJobRecommendationQuery } from '../utils/buildJobRecommendationQuery';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';

type JobPostUpdatePayload = Record<string, any>;

export default class JobPostService extends CRUDService {
  private profileHandler: ApplicationProfileHandler;
  private statsHandler: JobPostStatsHandler;

  constructor() {
    super(JobPostHandler);
    this.queryKeys = ['title', 'department', 'description', 'requirements', 'preferredQualifications', 'location.city', 'location.state', 'location.country'];
    this.profileHandler = new ApplicationProfileHandler();
    this.statsHandler = new JobPostStatsHandler();
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const teamId = this.requireTeamProfile(req.user);
      const data = req.body;

      const created = await this.handler.create({
        ...data,
        team: teamId,
        createdBy: req.user._id,
        status: data.status || 'draft',
      });

      return res.status(201).json({
        success: true,
        payload: created,
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  public getResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const job = await JobPostModel.findById(req.params.id).select('-viewers').lean();

      if (!job) {
        throw new ErrorUtil('Job post not found', 404);
      }

      const userId = new mongoose.Types.ObjectId(String(authReq.user._id));
      const rawIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? (req as any).socket?.remoteAddress ?? '';
      const ip = rawIp.replace(/^::ffff:/, '');

      (this.handler as JobPostHandler).recordView(String(req.params.id), userId, ip).catch(() => {});

      return res.status(200).json({
        success: true,
        payload: job,
      });
    } catch (err) {
      return error(err, req, res);
    }
  };

  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authReq = req as AuthenticatedRequest;

      const existing = await this.handler.fetch(req.params.id);

      if (!existing) {
        throw new ErrorUtil('Job post not found', 404);
      }

      const payload = req.body;

      if (Object.keys(payload).length === 0) {
        throw new ErrorUtil('No valid job post fields provided for update', 400);
      }

      let updated;

      const isAdmin = Array.isArray(authReq.user?.role) && authReq.user.role.includes('admin');

      if (isAdmin) {
        updated = await this.handler.update(req.params.id, payload);
      } else {
        const teamId = this.requireTeamProfile(authReq.user);
        const existingTeamId = String((existing.team as any)?._id ?? existing.team);

        if (existingTeamId !== teamId) {
          throw new ErrorUtil('Forbidden: you do not own this job post', 403);
        }

        updated = await this.handler.updateOwned(req.params.id, teamId, payload);
      }

      if (!updated) {
        throw new ErrorUtil('Job post not found', 404);
      }

      return res.status(200).json({
        success: true,
        payload: updated,
      });
    } catch (err) {
      return error(err, req, res);
    }
  };

  public removeResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const existing = await this.handler.fetch(req.params.id);

      if (!existing) {
        throw new ErrorUtil('Job post not found', 404);
      }

      if (Array.isArray(authReq.user?.role) && authReq.user.role.includes('admin')) {
        await this.handler.delete(req.params.id);
      } else {
        const teamId = this.requireTeamProfile(authReq.user);
        const existingTeamId = String((existing.team as any)?._id ?? existing.team);

        if (existingTeamId !== teamId) {
          throw new ErrorUtil('Forbidden: you do not own this job post', 403);
        }

        const deleted = await this.handler.deleteOwned(req.params.id, teamId);

        if (!deleted) {
          throw new ErrorUtil('Job post not found', 404);
        }
      }

      return res.status(200).json({
        success: true,
      });
    } catch (err) {
      return error(err, req, res);
    }
  };

  public getResources = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const pageSize = Number(req.query?.pageLimit) || 10;
      const page = Number(req.query?.pageNumber) || 1;

      const keywordQuery = AdvFilters.query(this.queryKeys, req.query?.keyword as string);
      const filterIncludeOptions = AdvFilters.filter(req.query?.includeOptions as string);
      const orConditions = [
        ...(Object.keys(keywordQuery[0]).length > 0 ? keywordQuery : []),
        ...(Array.isArray(filterIncludeOptions) && filterIncludeOptions.length > 0 && Object.keys(filterIncludeOptions[0]).length > 0 ? filterIncludeOptions : []),
      ];

      const options = {
        filters: AdvFilters.filter(req.query?.filterOptions as string),
        sort: AdvFilters.sort((req.query?.sortOptions as string) || '-createdAt'),
        query: orConditions,
        page,
        limit: pageSize,
      };

      const profileId = this.profileHandler.getProfessionalProfileId(authReq.user);
      let appliedIds: mongoose.Types.ObjectId[] = [];

      if (profileId) {
        const applications = await JobApplicationModel.find({ applicant: profileId }).select('job').lean();
        appliedIds = applications.map((a) => a.job as mongoose.Types.ObjectId);
      }

      const [result] = await (this.handler as JobPostHandler).fetchAllAnnotated(options, appliedIds);

      return res.status(200).json({
        success: true,
        payload: [...result.entries],
        metadata: {
          page,
          pages: Math.ceil(result.metadata[0]?.totalCount / pageSize) || 0,
          totalCount: result.metadata[0]?.totalCount || 0,
          prevPage: page - 1,
          nextPage: page + 1,
        },
      });
    } catch (err) {
      return error(err, req, res);
    }
  };

  private requireTeamProfile(user: AuthenticatedRequest['user'] | null | undefined): string {
    if (!Array.isArray(user?.role) || !user.profileRefs?.team) {
      throw new ErrorUtil('Only team users can perform this action', 403);
    }

    return String(user!.profileRefs.team);
  }

  public getTeamStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const teamId = this.requireTeamProfile(req.user);
      const stats = await this.statsHandler.getTeamStats(teamId);
      return res.status(200).json({ success: true, payload: stats });
    } catch (err) {
      return error(err, req, res);
    }
  });

  public getRecommended = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const page = Math.max(1, Number(req.query?.pageNumber) || 1);
      const limit = Math.max(1, Math.min(50, Number(req.query?.pageLimit) || 20));

      const profileId = this.profileHandler.getProfessionalProfileId(req.user);

      if (!profileId) {
        return this.recommendedFallback(res, page, limit);
      }

      const [profile, resumeId] = await Promise.all([ProfessionalProfileModel.findById(profileId).lean(), this.profileHandler.findResumeId(profileId)]);

      const resume = resumeId ? await ResumeProfile.findById(resumeId).lean() : null;

      const pastApplications = await JobApplicationModel.find({ applicant: profileId }).select('job').lean();

      const pastJobIds = pastApplications.map((a) => a.job as mongoose.Types.ObjectId);

      const pastJobPosts =
        pastJobIds.length > 0
          ? await JobPostModel.find({ _id: { $in: pastJobIds } })
              .select('title department industries')
              .lean()
          : [];

      const { orConditions, industryTerms } = buildJobRecommendationQuery(profile as any, resume as any, pastJobPosts);

      if (industryTerms.length > 0) {
        orConditions.push({ industries: { $in: industryTerms } });
      }

      if (orConditions.length === 0) {
        return this.recommendedFallback(res, page, limit, pastJobIds);
      }

      const { payload, metadata } = await (this.handler as JobPostHandler).fetchRecommended(orConditions, pastJobIds, page, limit);

      return res.status(200).json({
        success: true,
        payload,
        metadata: {
          page,
          pages: Math.ceil((metadata.totalCount || 0) / limit) || 0,
          totalCount: metadata.totalCount || 0,
          prevPage: page - 1,
          nextPage: page + 1,
        },
      });
    } catch (err) {
      return error(err, req, res);
    }
  });

  private async recommendedFallback(res: Response, page: number, limit: number, appliedIds: mongoose.Types.ObjectId[] = []): Promise<Response> {
    const now = new Date();
    const [result] = await JobPostModel.aggregate([
      {
        $match: {
          status: 'published',
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
        },
      },
      {
        $lookup: {
          from: 'jobapplications',
          localField: '_id',
          foreignField: 'job',
          as: 'applications',
        },
      },
      { $addFields: { applicationCount: { $size: '$applications' } } },
      { $project: { applications: 0 } },
      { $sort: { applicationCount: -1, createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page, limit } }],
          entries: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $addFields: { applied: { $in: ['$_id', appliedIds] } } }],
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      payload: result?.entries ?? [],
      metadata: {
        page,
        pages: Math.ceil((result?.metadata?.[0]?.totalCount || 0) / limit) || 0,
        totalCount: result?.metadata?.[0]?.totalCount || 0,
        prevPage: page - 1,
        nextPage: page + 1,
        mode: 'fallback',
      },
    });
  }
}
