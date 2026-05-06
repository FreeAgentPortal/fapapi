import mongoose, { Document, Schema, Types } from 'mongoose';

export const JOB_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'volunteer'] as const;
export const JOB_LOCATION_TYPES = ['onsite', 'remote', 'hybrid'] as const;
export const JOB_COMPENSATION_PERIODS = ['hourly', 'salary', 'stipend'] as const;
export const JOB_STATUSES = ['draft', 'published', 'closed', 'archived'] as const;

export interface JobLocation {
  city?: string;
  state?: string;
  country?: string;
}

export interface JobCompensation {
  min?: number;
  max?: number;
  currency?: string;
  period?: (typeof JOB_COMPENSATION_PERIODS)[number];
}

export interface IJobPost extends Document {
  team: Types.ObjectId;
  createdBy: Types.ObjectId;
  title: string;
  department?: string;
  employmentType: (typeof JOB_EMPLOYMENT_TYPES)[number];
  locationType: (typeof JOB_LOCATION_TYPES)[number];
  location?: JobLocation;
  description: string;
  requirements: string[];
  preferredQualifications: string[];
  compensation?: JobCompensation;
  status: (typeof JOB_STATUSES)[number];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobLocationSchema = new Schema<JobLocation>(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const JobCompensationSchema = new Schema<JobCompensation>(
  {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, trim: true, uppercase: true },
    period: { type: String, enum: JOB_COMPENSATION_PERIODS },
  },
  { _id: false }
);

const JobPostSchema = new Schema<IJobPost>(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: 'TeamProfile',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    employmentType: {
      type: String,
      required: true,
      enum: JOB_EMPLOYMENT_TYPES,
    },
    locationType: {
      type: String,
      required: true,
      enum: JOB_LOCATION_TYPES,
    },
    location: {
      type: JobLocationSchema,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requirements: {
      type: [String],
      default: [],
    },
    preferredQualifications: {
      type: [String],
      default: [],
    },
    compensation: {
      type: JobCompensationSchema,
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'draft',
      index: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

JobPostSchema.index({ status: 1 });
JobPostSchema.index({ team: 1 });
JobPostSchema.index({ title: 1 });
JobPostSchema.index({ 'location.city': 1, 'location.state': 1, 'location.country': 1 });
JobPostSchema.index({ createdAt: -1 });

export const JobPostModel = mongoose.model<IJobPost>('JobPost', JobPostSchema);

export default JobPostModel;
