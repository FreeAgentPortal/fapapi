import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import JobApplicationModel, { IJobApplication, JOB_APPLICATION_STATUSES } from '../models/JobApplication';

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
    const application = await this.requireApplication(applicationId);
    const status = this.parseStatus(nextStatus);

    if (!TEAM_MANAGED_APPLICATION_STATUSES.includes(status)) {
      throw new ErrorUtil('Invalid application status for this action', 400);
    }

    if (!this.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not own this application', 403);
    }

    this.assertTransitionAllowed(application.status, status);

    application.status = status;
    application.statusHistory = [...(application.statusHistory || []), this.buildStatusHistoryEntry(status, changedByUserId, note)];

    await application.save();
    await this.afterUpdate(application);

    return application;
  }

  async withdraw(applicationId: string, applicantProfileId: string | null | undefined, changedByUserId: string, note?: unknown): Promise<IJobApplication> {
    if (!applicantProfileId) {
      throw new ErrorUtil('User must have a professional profile to withdraw an application', 403);
    }

    const application = await this.requireApplication(applicationId);

    if (String(application.applicant) !== String(applicantProfileId)) {
      throw new ErrorUtil('Forbidden: you do not own this application', 403);
    }

    this.assertTransitionAllowed(application.status, 'withdrawn');

    application.status = 'withdrawn';
    application.statusHistory = [...(application.statusHistory || []), this.buildStatusHistoryEntry('withdrawn', changedByUserId, note)];

    await application.save();
    await this.afterUpdate(application);

    return application;
  }

  private async requireApplication(applicationId: string): Promise<IJobApplication> {
    const application = await this.Schema.findById(applicationId);

    if (!application) {
      throw new ErrorUtil('Application not found', 404);
    }

    return application;
  }

  private parseStatus(status: unknown): IJobApplication['status'] {
    if (typeof status !== 'string' || !JOB_APPLICATION_STATUSES.includes(status as (typeof JOB_APPLICATION_STATUSES)[number])) {
      throw new ErrorUtil('Invalid application status', 400);
    }

    return status as IJobApplication['status'];
  }

  private buildStatusHistoryEntry(status: IJobApplication['status'], changedByUserId: string, note?: unknown): IJobApplication['statusHistory'][number] {
    if (!Types.ObjectId.isValid(changedByUserId)) {
      throw new ErrorUtil('Invalid user context for application status change', 400);
    }

    const normalizedNote = typeof note === 'string' ? note.trim() : undefined;

    return {
      status,
      changedBy: new Types.ObjectId(changedByUserId),
      changedAt: new Date(),
      ...(normalizedNote ? { note: normalizedNote } : {}),
    };
  }

  private assertTransitionAllowed(currentStatus: IJobApplication['status'], nextStatus: IJobApplication['status']): void {
    if (currentStatus === nextStatus) {
      throw new ErrorUtil(`Application is already ${currentStatus}`, 400);
    }

    if (TERMINAL_APPLICATION_STATUSES.includes(currentStatus)) {
      throw new ErrorUtil(`Application status cannot be changed once it is ${currentStatus}`, 400);
    }
  }

  private canManageApplication(actor: ApplicationActorContext | null | undefined, teamId: IJobApplication['team']): boolean {
    if (!actor) {
      return false;
    }

    if (Array.isArray(actor.role) && actor.role.includes('admin')) {
      return true;
    }

    return Array.isArray(actor.role) && actor.role.includes('team') && String(actor.profileRefs?.team) === String(teamId);
  }
}
