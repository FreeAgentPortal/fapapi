import mongoose, { Schema } from 'mongoose';

export type ProfileViewDeliveryChannel = 'email' | 'sms';

interface IProfileViewMilestoneDelivery {
  // Deterministic IDs also protect claims before any secondary indexes exist.
  _id: string;
  kind: 'launch' | 'gate' | 'delivery';
  launchedAt?: Date;
  ownerUserId?: mongoose.Types.ObjectId;
  subjectType?: 'athlete' | 'professional';
  subjectProfileId?: mongoose.Types.ObjectId;
  month?: string;
  channel?: ProfileViewDeliveryChannel;
  highestDeliveredMilestone?: number;
  lastSentAt?: Date;
  lastAttemptDay?: string;
  lastAttemptAt?: Date;
  failedAt?: Date;
  lockToken?: string;
  lockedUntil?: Date;
}

const schema = new Schema<IProfileViewMilestoneDelivery>(
  {
    _id: { type: String, required: true },
    kind: { type: String, enum: ['launch', 'gate', 'delivery'], required: true },
    launchedAt: Date,
    ownerUserId: Schema.Types.ObjectId,
    subjectType: { type: String, enum: ['athlete', 'professional'] },
    subjectProfileId: Schema.Types.ObjectId,
    month: String,
    channel: { type: String, enum: ['email', 'sms'] },
    highestDeliveredMilestone: Number,
    lastSentAt: Date,
    lastAttemptDay: String,
    lastAttemptAt: Date,
    failedAt: Date,
    lockToken: String,
    lockedUntil: Date,
  },
  // No automatic DDL on import: even the first dry run must be read-only.
  { timestamps: true, collection: 'profile_view_milestone_deliveries', autoCreate: false, autoIndex: false }
);

export const ProfileViewMilestoneDeliveryModel = mongoose.model<IProfileViewMilestoneDelivery>('ProfileViewMilestoneDelivery', schema);
