import mongoose, { Schema, Types } from 'mongoose';

export const JOB_SOURCE_PROVIDERS = ['greenhouse', 'lever'] as const;
export type JobSourceProvider = (typeof JOB_SOURCE_PROVIDERS)[number];

export interface IJobSource {
  _id: Types.ObjectId;
  name: string;
  organizationName: string;
  provider: JobSourceProvider;
  url: string;
  boardToken: string;
  region: 'global' | 'eu';
  enabled: boolean;
  createdBy: Types.ObjectId;
  nextRunAt: Date;
  lastCheckedAt?: Date;
  lastSuccessfulAt?: Date;
  consecutiveFailures: number;
  lastError?: string;
  lastResult?: { fetched: number; created: number; updated: number; closed: number };
  lockToken?: string; 
  lockedUntil?: Date;
}

const JobSourceSchema = new Schema<IJobSource>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    organizationName: { type: String, required: true, trim: true, maxlength: 200 },
    provider: { type: String, enum: JOB_SOURCE_PROVIDERS, required: true },
    url: { type: String, required: true },
    boardToken: { type: String, required: true },
    region: { type: String, enum: ['global', 'eu'], default: 'global' },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    nextRunAt: { type: Date, default: Date.now },
    lastCheckedAt: Date,
    lastSuccessfulAt: Date,
    consecutiveFailures: { type: Number, default: 0 },
    lastError: String,
    lastResult: {
      type: new Schema({ fetched: Number, created: Number, updated: Number, closed: Number }, { _id: false }),
    },
    lockToken: { type: String, select: false },
    lockedUntil: Date,
  },
  { timestamps: true }
);

JobSourceSchema.index({ provider: 1, region: 1, boardToken: 1 }, { unique: true });
JobSourceSchema.index({ enabled: 1, nextRunAt: 1 });

export default mongoose.model<IJobSource>('JobSource', JobSourceSchema);
