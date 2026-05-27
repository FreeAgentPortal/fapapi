import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import JobApplicationModel, { IApplicationNote, IJobApplication, JOB_APPLICATION_STATUSES } from '../models/JobApplication';

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

  async reject(applicationId: string, changedByUserId: string, actor: ApplicationActorContext | null | undefined, rejectionMessage?: unknown): Promise<IJobApplication> {
    const application = await this.requireApplication(applicationId);

    if (!this.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to reject this application', 403);
    }

    this.assertTransitionAllowed(application.status, 'rejected');

    application.status = 'rejected';
    application.statusHistory = [...(application.statusHistory || []), this.buildStatusHistoryEntry('rejected', changedByUserId, undefined)];

    if (typeof rejectionMessage === 'string' && rejectionMessage.trim()) {
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

    return String(actor.profileRefs?.team) === String(teamId);
  }

  async addNote(
    applicationId: string,
    payload: { header: unknown; body: unknown },
    authorUserId: string,
    actor: ApplicationActorContext | null | undefined
  ): Promise<IJobApplication> {
    const application = await this.requireApplication(applicationId);

    if (!this.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to add notes to this application', 403);
    }

    if (typeof payload.header !== 'string' || !payload.header.trim()) {
      throw new ErrorUtil('Note header is required', 400);
    }

    if (typeof payload.body !== 'string' || !payload.body.trim()) {
      throw new ErrorUtil('Note body is required', 400);
    }

    if (!Types.ObjectId.isValid(authorUserId)) {
      throw new ErrorUtil('Invalid user context for note authorship', 400);
    }

    application.notes.push({
      _id: new Types.ObjectId(),
      header: payload.header.trim(),
      body: payload.body.trim(),
      author: new Types.ObjectId(authorUserId),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IApplicationNote);

    await application.save();
    return application;
  }

  async updateNote(
    applicationId: string,
    noteId: string,
    payload: { header?: unknown; body?: unknown },
    actor: ApplicationActorContext | null | undefined
  ): Promise<IJobApplication> {
    const application = await this.requireApplication(applicationId);

    if (!this.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to update notes on this application', 403);
    }

    const note = application.notes.find((n) => String(n._id) === noteId);

    if (!note) {
      throw new ErrorUtil('Note not found', 404);
    }

    if (typeof payload.header === 'string' && payload.header.trim()) {
      note.header = payload.header.trim();
    }

    if (typeof payload.body === 'string' && payload.body.trim()) {
      note.body = payload.body.trim();
    }

    note.updatedAt = new Date();

    await application.save();
    return application;
  }

  async removeNote(applicationId: string, noteId: string, actor: ApplicationActorContext | null | undefined): Promise<IJobApplication> {
    const application = await this.requireApplication(applicationId);

    if (!this.canManageApplication(actor, application.team)) {
      throw new ErrorUtil('Forbidden: you do not have permission to remove notes from this application', 403);
    }

    const noteIndex = application.notes.findIndex((n) => String(n._id) === noteId);

    if (noteIndex === -1) {
      throw new ErrorUtil('Note not found', 404);
    }

    application.notes.splice(noteIndex, 1);

    await application.save();
    return application;
  }
}
