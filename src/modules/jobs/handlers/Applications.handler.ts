import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import JobApplicationModel, { IJobApplication, JOB_APPLICATION_STATUSES } from '../models/JobApplication';
import { ApplicationHandlerUtils } from '../utils/ApplicationHandlerUtils';

type ApplicationActorContext = {
  role?: string[];
  profileRefs?: Record<string, string | null>;
};

const TEAM_MANAGED_APPLICATION_STATUSES: IJobApplication['status'][] = ['reviewing', 'shortlisted', 'contacted', 'rejected', 'hired'];
const TERMINAL_APPLICATION_STATUSES: IJobApplication['status'][] = ['rejected', 'hired', 'withdrawn'];

export default class ApplicationHandler extends CRUDHandler<IJobApplication> {
  constructor() {
    super(JobApplicationModel);
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: any[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query?.length > 0 && { $or: options.query }),
        },
      },
      {
        $sort: options.sort ?? { createdAt: -1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
              $lookup: {
                from: 'jobposts',
                localField: 'job',
                foreignField: '_id',
                as: 'job',
              },
            },
            {
              $lookup: {
                from: 'teamprofiles',
                localField: 'team',
                foreignField: '_id',
                as: 'team',
                pipeline: [{ $project: { name: 1, logoUrl: 1 } }],
              },
            },
            {
              $lookup: {
                from: 'professional_profiles',
                localField: 'applicant',
                foreignField: '_id',
                as: 'applicant',
                pipeline: [{ $project: { displayName: 1, headline: 1, avatarUrl: 1 } }],
              },
            },
            {
              $unwind: {
                path: '$job',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: '$team',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: '$applicant',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);
  }

  async fetchAllForApplicant(options: PaginationOptions): Promise<{ entries: any[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query?.length > 0 && { $or: options.query }),
        },
      },
      {
        $sort: options.sort ?? { createdAt: -1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
              $lookup: {
                from: 'jobposts',
                localField: 'job',
                foreignField: '_id',
                as: 'job',
                pipeline: [{ $project: { viewCount: 0, viewers: 0} }],
              },
            },
            {
              $lookup: {
                from: 'teamprofiles',
                localField: 'team',
                foreignField: '_id',
                as: 'team',
                pipeline: [{ $project: { name: 1, logoUrl: 1 } }],
              },
            },
            {
              $lookup: {
                from: 'professional_profiles',
                localField: 'applicant',
                foreignField: '_id',
                as: 'applicant',
                pipeline: [{ $project: { displayName: 1, headline: 1, avatarUrl: 1 } }],
              },
            },
            {
              $unwind: {
                path: '$job',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: '$team',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: '$applicant',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                notes: 0,
                matchScore: 0,
                matchReasons: 0,
                statusHistory: 0,
              },
            },
          ],
        },
      },
    ]);
  }

  async hasAppliedToJob(jobId: string, applicantProfileId: string): Promise<boolean> {
    const existingApplication = await this.Schema.exists({
      job: jobId,
      applicant: applicantProfileId,
    });

    return existingApplication !== null;
  }

  async getStatusCounts(applicantProfileId: string): Promise<Record<string, number>> {
    const results = await this.Schema.aggregate([{ $match: { applicant: new Types.ObjectId(applicantProfileId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);

    const counts: Record<string, number> = Object.fromEntries(JOB_APPLICATION_STATUSES.map((s) => [s, 0]));
    for (const result of results) {
      counts[result._id] = result.count;
    }
    return counts;
  }

  async updateStatus(
    applicationId: string,
    nextStatus: unknown,
    changedByUserId: string,
    actor: ApplicationActorContext | null | undefined,
    note?: unknown
  ): Promise<IJobApplication> {
    const application = await ApplicationHandlerUtils.requireApplication(this.Schema, applicationId);
    const status = ApplicationHandlerUtils.parseStatus(nextStatus);

    if (!TEAM_MANAGED_APPLICATION_STATUSES.includes(status)) {
      throw new ErrorUtil('Invalid application status for this action', 400);
    }

    if (!ApplicationHandlerUtils.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not own this application', 403);
    }

    ApplicationHandlerUtils.assertTransitionAllowed(application.status, status, TERMINAL_APPLICATION_STATUSES);

    application.status = status;
    application.statusHistory = [...(application.statusHistory || []), ApplicationHandlerUtils.buildStatusHistoryEntry(status, changedByUserId, note)];

    await application.save();
    await this.afterUpdate(application);

    return application;
  }

  async reject(applicationId: string, changedByUserId: string, actor: ApplicationActorContext | null | undefined, rejectionMessage?: string): Promise<IJobApplication> {
    const application = await ApplicationHandlerUtils.requireApplication(this.Schema, applicationId);

    if (!ApplicationHandlerUtils.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to reject this application', 403);
    }

    ApplicationHandlerUtils.assertTransitionAllowed(application.status, 'rejected', TERMINAL_APPLICATION_STATUSES);

    application.status = 'rejected';
    application.statusHistory = [...(application.statusHistory || []), ApplicationHandlerUtils.buildStatusHistoryEntry('rejected', changedByUserId, undefined)];

    if (rejectionMessage?.trim()) {
      application.rejectionMessage = rejectionMessage.trim();
    }

    await application.save();
    await this.afterUpdate(application);

    return application;
  }

  async withdraw(applicationId: string, applicantProfileId: string | null | undefined, changedByUserId: string, note?: unknown): Promise<IJobApplication> {
    if (!applicantProfileId) {
      throw new ErrorUtil('User must have a professional profile to withdraw an application', 403);
    }

    const application = await ApplicationHandlerUtils.requireApplication(this.Schema, applicationId);

    if (String(application.applicant) !== String(applicantProfileId)) {
      throw new ErrorUtil('Forbidden: you do not own this application', 403);
    }

    ApplicationHandlerUtils.assertTransitionAllowed(application.status, 'withdrawn', TERMINAL_APPLICATION_STATUSES);

    application.status = 'withdrawn';
    application.statusHistory = [...(application.statusHistory || []), ApplicationHandlerUtils.buildStatusHistoryEntry('withdrawn', changedByUserId, note)];

    await application.save();
    await this.afterUpdate(application);

    return application;
  }
}
