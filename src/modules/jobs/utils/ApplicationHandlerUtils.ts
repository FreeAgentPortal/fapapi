import { Types } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { IJobApplication, JOB_APPLICATION_STATUSES } from '../models/JobApplication';

type ApplicationActorContext = {
  role?: string[];
  profileRefs?: Record<string, string | null>;
};

export class ApplicationHandlerUtils {
  static requireApplication(schema: any, applicationId: string): Promise<IJobApplication> {
    return schema.findById(applicationId).then((application: IJobApplication | null) => {
      if (!application) {
        throw new ErrorUtil('Application not found', 404);
      }
      return application;
    });
  }

  static parseStatus(status: unknown): IJobApplication['status'] {
    if (typeof status !== 'string' || !JOB_APPLICATION_STATUSES.includes(status as (typeof JOB_APPLICATION_STATUSES)[number])) {
      throw new ErrorUtil('Invalid application status', 400);
    }
    return status as IJobApplication['status'];
  }

  static buildStatusHistoryEntry(status: IJobApplication['status'], changedByUserId: string, note?: unknown): IJobApplication['statusHistory'][number] {
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

  static assertTransitionAllowed(currentStatus: IJobApplication['status'], nextStatus: IJobApplication['status'], terminalStatuses: IJobApplication['status'][]): void {
    if (currentStatus === nextStatus) {
      throw new ErrorUtil(`Application is already ${currentStatus}`, 400);
    }
    if (terminalStatuses.includes(currentStatus)) {
      throw new ErrorUtil(`Application status cannot be changed once it is ${currentStatus}`, 400);
    }
  }

  static canManageApplication(actor: ApplicationActorContext | null | undefined, teamId: IJobApplication['team']): boolean {
    if (!actor) {
      return false;
    }
    return String(actor.profileRefs?.team) === String(teamId);
  }

  static async hasAppliedToJob(schema: any, jobId: string, applicantProfileId: string): Promise<boolean> {
    const existing = await schema.exists({ job: jobId, applicant: applicantProfileId });
    return existing !== null;
  }
}
