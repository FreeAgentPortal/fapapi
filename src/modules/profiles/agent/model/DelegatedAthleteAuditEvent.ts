import mongoose, { Document, Schema, Types } from 'mongoose';

export type DelegatedAthleteAction =
  | 'athlete.profile.update'
  | 'athlete.resume.create'
  | 'athlete.resume.visibility.update'
  | 'athlete.resume.item.create'
  | 'athlete.resume.item.update'
  | 'athlete.resume.item.delete';

export type DelegatedAthleteResourceType =
  | 'athlete_profile'
  | 'resume'
  | 'experience'
  | 'education'
  | 'award'
  | 'reference'
  | 'media';

export interface IDelegatedAthleteAuditEvent extends Document {
  actorUserId: Types.ObjectId;
  actorAgentProfileId: Types.ObjectId;
  subjectAthleteUserId: Types.ObjectId;
  subjectAthleteProfileId: Types.ObjectId;
  assignmentId: Types.ObjectId;
  action: DelegatedAthleteAction;
  resourceType: DelegatedAthleteResourceType;
  resourceId: Types.ObjectId;
  changedFields: string[];
  source: 'agent_portal';
  requestId: string;
  occurredAt: Date;
}

const DelegatedAthleteAuditEventSchema = new Schema<IDelegatedAthleteAuditEvent>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    actorAgentProfileId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true, immutable: true },
    subjectAthleteUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    subjectAthleteProfileId: { type: Schema.Types.ObjectId, ref: 'AthleteProfile', required: true, immutable: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'AgentAthleteAssignment', required: true, immutable: true },
    action: {
      type: String,
      enum: [
        'athlete.profile.update',
        'athlete.resume.create',
        'athlete.resume.visibility.update',
        'athlete.resume.item.create',
        'athlete.resume.item.update',
        'athlete.resume.item.delete',
      ],
      required: true,
      immutable: true,
    },
    resourceType: {
      type: String,
      enum: ['athlete_profile', 'resume', 'experience', 'education', 'award', 'reference', 'media'],
      required: true,
      immutable: true,
    },
    resourceId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    changedFields: { type: [String], required: true, immutable: true },
    source: { type: String, enum: ['agent_portal'], required: true, immutable: true },
    requestId: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
    occurredAt: { type: Date, required: true, immutable: true },
  },
  {
    collection: 'delegated_athlete_audit_events',
    timestamps: false,
    versionKey: false,
  }
);

DelegatedAthleteAuditEventSchema.index({ subjectAthleteProfileId: 1, occurredAt: -1 });
DelegatedAthleteAuditEventSchema.index({ actorAgentProfileId: 1, occurredAt: -1 });
DelegatedAthleteAuditEventSchema.index({ requestId: 1, action: 1 });

export const DelegatedAthleteAuditEventModel = mongoose.model<IDelegatedAthleteAuditEvent>(
  'DelegatedAthleteAuditEvent',
  DelegatedAthleteAuditEventSchema
);
