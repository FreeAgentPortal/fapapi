import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IManagedAthleteNotificationPayload {
  notificationType: 'agent.athlete-profile.updated' | 'agent.athlete-resume.updated';
  userTo: Types.ObjectId;
  userFrom: Types.ObjectId;
  entityId: Types.ObjectId;
  message: string;
  description: string;
}

export interface IManagedAthleteOutboxEvent extends Document {
  _id: Types.ObjectId;
  eventType: 'agent.managed-athlete.notification.requested';
  payload: IManagedAthleteNotificationPayload;
  status: 'pending' | 'processing' | 'published';
  attempts: number;
  availableAt: Date;
  processingStartedAt?: Date;
  publishedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ManagedAthleteNotificationPayloadSchema = new Schema<IManagedAthleteNotificationPayload>(
  {
    notificationType: {
      type: String,
      enum: ['agent.athlete-profile.updated', 'agent.athlete-resume.updated'],
      required: true,
    },
    userTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userFrom: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    message: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const ManagedAthleteOutboxEventSchema = new Schema<IManagedAthleteOutboxEvent>(
  {
    eventType: {
      type: String,
      enum: ['agent.managed-athlete.notification.requested'],
      required: true,
      default: 'agent.managed-athlete.notification.requested',
    },
    payload: { type: ManagedAthleteNotificationPayloadSchema, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'published'],
      required: true,
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    availableAt: { type: Date, required: true, default: Date.now, index: true },
    processingStartedAt: { type: Date },
    publishedAt: { type: Date },
    lastError: { type: String, maxlength: 2000 },
  },
  {
    collection: 'managed_athlete_outbox_events',
    timestamps: true,
  }
);

ManagedAthleteOutboxEventSchema.index({ status: 1, availableAt: 1, createdAt: 1 });

export const ManagedAthleteOutboxEventModel = mongoose.model<IManagedAthleteOutboxEvent>(
  'ManagedAthleteOutboxEvent',
  ManagedAthleteOutboxEventSchema
);
