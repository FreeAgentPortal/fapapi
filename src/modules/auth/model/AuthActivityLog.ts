import mongoose, { InferSchemaType, Schema, Types } from 'mongoose';

const AuthActivityLogSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionHash: {
      type: String,
      required: true,
      index: true,
    },
    sessionSource: {
      type: String,
      enum: ['header', 'jwt'],
      required: true,
    },
    bucketStart: {
      type: Date,
      required: true,
    },
    firstSeenAt: {
      type: Date,
      required: true,
    },
    lastSeenAt: {
      type: Date,
      required: true,
      index: true,
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPath: {
      type: String,
      required: true,
    },
    lastMethod: {
      type: String,
      required: true,
    },
    lastServiceName: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    roles: {
      type: [String],
      default: [],
      index: true,
    },
    profileRefs: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'auth_activity_logs',
  }
);

AuthActivityLogSchema.index({ userId: 1, sessionHash: 1, bucketStart: 1 }, { unique: true });
AuthActivityLogSchema.index({ bucketStart: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
AuthActivityLogSchema.index({ lastSeenAt: -1 });

export type AuthActivityLogType = InferSchemaType<typeof AuthActivityLogSchema>;

const AuthActivityLog = mongoose.models.AuthActivityLog || mongoose.model<AuthActivityLogType>('AuthActivityLog', AuthActivityLogSchema);

export default AuthActivityLog;
