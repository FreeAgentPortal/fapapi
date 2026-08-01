import mongoose, { ClientSession, Types } from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { ResumeProfile } from '../../resume/models/ResumeProfile';
import {
  DelegatedAthleteAction,
  DelegatedAthleteAuditEventModel,
  DelegatedAthleteResourceType,
} from '../model/DelegatedAthleteAuditEvent';
import { ManagedAthleteOutboxEventModel } from '../model/ManagedAthleteOutboxEvent';
import { ManagedAthleteAccessContext, ManagedAthleteAccessService } from './ManagedAthleteAccess.service';
import { ManagedAthleteOutboxService } from './ManagedAthleteOutbox.service';
import {
  MANAGED_RESUME_SECTIONS,
  ManagedResumeSection,
  validateManagedProfileUpdate,
  validateManagedResumeCreateBody,
  validateManagedResumeSectionBody,
  validateManagedVisibilityBody,
  validatePathObjectId,
} from './ManagedAthleteValidation';

export interface ManagedAthleteIdentity {
  actorUserId: string;
  agentProfileId: string;
  requestId: string;
}

interface MutationMetadata {
  action: DelegatedAthleteAction;
  resourceType: DelegatedAthleteResourceType;
  resourceId: string;
  changedFields: string[];
  notification: 'profile' | 'resume';
  notificationEntityId: string;
}

interface MutationOutcome<T> {
  payload: T;
  metadata?: MutationMetadata;
}

const SECTION_CONFIG: Record<
  ManagedResumeSection,
  { arrayField: 'experiences' | 'education' | 'awards' | 'references' | 'media'; resourceType: DelegatedAthleteResourceType }
> = {
  experience: { arrayField: 'experiences', resourceType: 'experience' },
  education: { arrayField: 'education', resourceType: 'education' },
  award: { arrayField: 'awards', resourceType: 'award' },
  reference: { arrayField: 'references', resourceType: 'reference' },
  media: { arrayField: 'media', resourceType: 'media' },
};

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function mapToObject(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  return value;
}

function serializeManagedAthlete(athlete: any): Record<string, unknown> {
  return {
    _id: athlete._id,
    fullName: athlete.fullName,
    sport: athlete.sport || 'football',
    profileImageUrl: athlete.profileImageUrl,
    bio: athlete.bio,
    birthPlace: athlete.birthPlace,
    college: athlete.college,
    highSchool: athlete.highSchool,
    graduationYear: athlete.graduationYear,
    positions: athlete.positions,
    experienceYears: athlete.experienceYears,
    strengths: athlete.strengths,
    weaknesses: athlete.weaknesses,
    testimony: athlete.testimony,
    awards: athlete.awards,
    measurements: mapToObject(athlete.measurements),
    metrics: mapToObject(athlete.metrics),
    highlightVideos: athlete.highlightVideos,
    createdAt: athlete.createdAt,
    updatedAt: athlete.updatedAt,
  };
}

function serializeAssignment(assignment: any): Record<string, unknown> {
  return {
    _id: assignment._id,
    status: assignment.status,
    acceptedAt: assignment.acceptedAt,
    removedAt: assignment.removedAt,
  };
}

function getResumeItem(resume: any, arrayField: string, itemId: string): Record<string, unknown> {
  const items = resume[arrayField];
  const item =
    typeof items?.id === 'function'
      ? items.id(itemId)
      : items?.find((candidate: any) => candidate._id?.toString() === itemId);
  if (!item) {
    throw new ErrorUtil('Resume item not found.', 404);
  }
  return typeof item.toObject === 'function' ? item.toObject() : item;
}

export class ManagedAthleteService {
  constructor(private readonly accessService = new ManagedAthleteAccessService()) {}

  async getWorkspace(identity: ManagedAthleteIdentity, athleteId: string): Promise<Record<string, unknown>> {
    const context = await this.accessService.resolve(identity.actorUserId, identity.agentProfileId, athleteId, {
      requireActive: false,
    });

    return {
      athlete: serializeManagedAthlete(context.athlete),
      assignment: serializeAssignment(context.assignment),
      capabilities: context.active
        ? {
            canManageProfile: true,
            canManageResume: true,
          }
        : {
            canManageProfile: false,
            canManageResume: false,
            denialReason: context.denialReason,
          },
    };
  }

  async updateProfile(
    identity: ManagedAthleteIdentity,
    athleteId: string,
    body: unknown
  ): Promise<Record<string, unknown>> {
    const update = validateManagedProfileUpdate(body);
    const changedFields = Object.keys(update);

    return this.runMutation(identity, athleteId, async (context, session) => {
      const athlete = await context.athlete.constructor.findOneAndUpdate(
        { _id: context.athlete._id },
        { $set: update },
        { new: true, runValidators: true, session }
      );
      if (!athlete) {
        throw new ErrorUtil('Athlete profile not found.', 404);
      }
      return {
        payload: serializeManagedAthlete(athlete),
        metadata: {
          action: 'athlete.profile.update',
          resourceType: 'athlete_profile',
          resourceId: athlete._id.toString(),
          changedFields,
          notification: 'profile',
          notificationEntityId: athlete._id.toString(),
        },
      };
    });
  }

  async getResume(identity: ManagedAthleteIdentity, athleteId: string): Promise<unknown> {
    await this.accessService.resolve(identity.actorUserId, identity.agentProfileId, athleteId, {
      requireActive: true,
    });
    const resume = await ResumeProfile.findOne({
      'owner.kind': 'AthleteProfile',
      'owner.ref': athleteId,
    });
    if (!resume) {
      throw new ErrorUtil('Athlete resume not found.', 404);
    }
    return resume;
  }

  async createResume(identity: ManagedAthleteIdentity, athleteId: string, body: unknown): Promise<unknown> {
    validateManagedResumeCreateBody(body, athleteId);

    return this.runMutation(identity, athleteId, async (_context, session) => {
      const generatedId = new Types.ObjectId();
      const resume = await ResumeProfile.findOneAndUpdate(
        {
          'owner.kind': 'AthleteProfile',
          'owner.ref': athleteId,
        },
        {
          $setOnInsert: {
            _id: generatedId,
            owner: { kind: 'AthleteProfile', ref: objectId(athleteId) },
            experiences: [],
            education: [],
            awards: [],
            qa: [],
            references: [],
            media: [],
            visibility: 'private',
            version: 1,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true,
          session,
        }
      );
      if (!resume) {
        throw new ErrorUtil('Unable to initialize athlete resume.', 500);
      }

      const created = resume._id.toString() === generatedId.toString();
      return {
        payload: resume,
        metadata: created
          ? {
              action: 'athlete.resume.create',
              resourceType: 'resume',
              resourceId: resume._id.toString(),
              changedFields: ['resume'],
              notification: 'resume',
              notificationEntityId: resume._id.toString(),
            }
          : undefined,
      };
    });
  }

  async updateResumeVisibility(
    identity: ManagedAthleteIdentity,
    athleteId: string,
    resumeId: string,
    body: unknown
  ): Promise<unknown> {
    validatePathObjectId(resumeId, 'resumeId');
    const visibility = validateManagedVisibilityBody(body);

    return this.runMutation(identity, athleteId, async (_context, session) => {
      const resume = await ResumeProfile.findOneAndUpdate(
        {
          _id: resumeId,
          'owner.kind': 'AthleteProfile',
          'owner.ref': athleteId,
        },
        {
          $set: { visibility },
          $inc: { version: 1 },
        },
        { new: true, runValidators: true, session }
      );
      if (!resume) {
        throw new ErrorUtil('Athlete resume not found.', 404);
      }
      return {
        payload: resume,
        metadata: {
          action: 'athlete.resume.visibility.update',
          resourceType: 'resume',
          resourceId: resume._id.toString(),
          changedFields: ['visibility'],
          notification: 'resume',
          notificationEntityId: resume._id.toString(),
        },
      };
    });
  }

  async createResumeItem(
    identity: ManagedAthleteIdentity,
    athleteId: string,
    sectionValue: string,
    body: unknown
  ): Promise<Record<string, unknown>> {
    const section = this.requireSection(sectionValue);
    const validated = validateManagedResumeSectionBody(section, body, athleteId, 'create');
    const resumeId = validated.resumeId!;
    const config = SECTION_CONFIG[section];

    return this.runMutation(identity, athleteId, async (_context, session) => {
      const itemId = new Types.ObjectId();
      const resume = await ResumeProfile.findOneAndUpdate(
        {
          _id: resumeId,
          'owner.kind': 'AthleteProfile',
          'owner.ref': athleteId,
        },
        {
          $push: { [config.arrayField]: { _id: itemId, ...validated.patch } },
          $inc: { version: 1 },
        },
        { new: true, runValidators: true, session }
      );
      if (!resume) {
        throw new ErrorUtil('Athlete resume not found.', 404);
      }
      return {
        payload: getResumeItem(resume, config.arrayField, itemId.toString()),
        metadata: {
          action: 'athlete.resume.item.create',
          resourceType: config.resourceType,
          resourceId: itemId.toString(),
          changedFields: [section, ...validated.changedFields],
          notification: 'resume',
          notificationEntityId: resume._id.toString(),
        },
      };
    });
  }

  async updateResumeItem(
    identity: ManagedAthleteIdentity,
    athleteId: string,
    sectionValue: string,
    itemId: string,
    body: unknown
  ): Promise<Record<string, unknown>> {
    const section = this.requireSection(sectionValue);
    validatePathObjectId(itemId, 'itemId');
    const validated = validateManagedResumeSectionBody(section, body, athleteId, 'update');
    const config = SECTION_CONFIG[section];

    return this.runMutation(identity, athleteId, async (_context, session) => {
      const filter: Record<string, unknown> = {
        'owner.kind': 'AthleteProfile',
        'owner.ref': objectId(athleteId),
        [`${config.arrayField}._id`]: objectId(itemId),
      };
      if (validated.resumeId) {
        filter._id = objectId(validated.resumeId);
      }

      const set: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(validated.patch)) {
        set[`${config.arrayField}.$[item].${field}`] = value;
      }

      const resume = await ResumeProfile.findOneAndUpdate(
        filter,
        {
          $set: set,
          $inc: { version: 1 },
        },
        {
          arrayFilters: [{ 'item._id': objectId(itemId) }],
          new: true,
          runValidators: true,
          session,
        }
      );
      if (!resume) {
        throw new ErrorUtil('Resume item not found for this athlete.', 404);
      }
      return {
        payload: getResumeItem(resume, config.arrayField, itemId),
        metadata: {
          action: 'athlete.resume.item.update',
          resourceType: config.resourceType,
          resourceId: itemId,
          changedFields: [section, ...validated.changedFields],
          notification: 'resume',
          notificationEntityId: resume._id.toString(),
        },
      };
    });
  }

  async deleteResumeItem(
    identity: ManagedAthleteIdentity,
    athleteId: string,
    sectionValue: string,
    resumeId: string,
    itemId: string
  ): Promise<Record<string, never>> {
    const section = this.requireSection(sectionValue);
    validatePathObjectId(resumeId, 'resumeId');
    validatePathObjectId(itemId, 'itemId');
    const config = SECTION_CONFIG[section];

    return this.runMutation(identity, athleteId, async (_context, session) => {
      const resume = await ResumeProfile.findOneAndUpdate(
        {
          _id: resumeId,
          'owner.kind': 'AthleteProfile',
          'owner.ref': athleteId,
          [`${config.arrayField}._id`]: itemId,
        },
        {
          $pull: { [config.arrayField]: { _id: objectId(itemId) } },
          $inc: { version: 1 },
        },
        { new: true, runValidators: true, session }
      );
      if (!resume) {
        throw new ErrorUtil('Resume item not found for this athlete.', 404);
      }
      return {
        payload: {},
        metadata: {
          action: 'athlete.resume.item.delete',
          resourceType: config.resourceType,
          resourceId: itemId,
          changedFields: [section],
          notification: 'resume',
          notificationEntityId: resume._id.toString(),
        },
      };
    });
  }

  private requireSection(value: string): ManagedResumeSection {
    if (!MANAGED_RESUME_SECTIONS.has(value as ManagedResumeSection)) {
      throw new ErrorUtil('Unsupported managed resume section.', 422);
    }
    return value as ManagedResumeSection;
  }

  private async runMutation<T>(
    identity: ManagedAthleteIdentity,
    athleteId: string,
    mutation: (context: ManagedAthleteAccessContext, session: ClientSession) => Promise<MutationOutcome<T>>
  ): Promise<T> {
    validatePathObjectId(athleteId, 'athleteId');
    const session = await mongoose.startSession();
    let result: T | undefined;
    let outboxId: string | undefined;

    try {
      await session.withTransaction(async () => {
        const context = await this.accessService.resolve(
          identity.actorUserId,
          identity.agentProfileId,
          athleteId,
          { requireActive: true, session }
        );
        const outcome = await mutation(context, session);
        result = outcome.payload;

        if (!outcome.metadata) {
          return;
        }
        if (!context.athlete.userId) {
          throw new ErrorUtil('Athlete user is unavailable for delegated audit attribution.', 409);
        }

        const occurredAt = new Date();
        const auditEvent = new DelegatedAthleteAuditEventModel({
          actorUserId: objectId(identity.actorUserId),
          actorAgentProfileId: objectId(identity.agentProfileId),
          subjectAthleteUserId: context.athlete.userId,
          subjectAthleteProfileId: context.athlete._id,
          assignmentId: context.assignment._id,
          action: outcome.metadata.action,
          resourceType: outcome.metadata.resourceType,
          resourceId: objectId(outcome.metadata.resourceId),
          changedFields: outcome.metadata.changedFields,
          source: 'agent_portal',
          requestId: identity.requestId,
          occurredAt,
        });
        await auditEvent.save({ session });

        const isProfileNotification = outcome.metadata.notification === 'profile';
        const outboxEvent = new ManagedAthleteOutboxEventModel({
          eventType: 'agent.managed-athlete.notification.requested',
          payload: {
            notificationType: isProfileNotification
              ? 'agent.athlete-profile.updated'
              : 'agent.athlete-resume.updated',
            userTo: context.athlete.userId,
            userFrom: objectId(identity.actorUserId),
            entityId: objectId(outcome.metadata.notificationEntityId),
            message: isProfileNotification
              ? 'Your agent updated your athlete profile.'
              : 'Your agent updated your athlete resume.',
            description: isProfileNotification
              ? 'Review your profile to see the latest changes.'
              : 'Review your resume to see the latest changes.',
          },
          status: 'pending',
          attempts: 0,
          availableAt: occurredAt,
        });
        await outboxEvent.save({ session });
        outboxId = outboxEvent._id.toString();
      });
    } finally {
      await session.endSession();
    }

    if (result === undefined) {
      throw new ErrorUtil('Managed athlete mutation did not complete.', 500);
    }

    if (outboxId) {
      try {
        await ManagedAthleteOutboxService.dispatchById(outboxId);
      } catch (error) {
        console.error(`[ManagedAthlete] Notification outbox event ${outboxId} remains pending:`, error);
      }
    }
    return result;
  }
}
