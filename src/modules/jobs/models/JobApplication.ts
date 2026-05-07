import mongoose, { Document, Schema, Types } from 'mongoose';

export const JOB_APPLICATION_STATUSES = ['submitted', 'reviewing', 'shortlisted', 'contacted', 'rejected', 'hired', 'withdrawn'] as const;

export interface JobApplicationStatusHistory {
  status: (typeof JOB_APPLICATION_STATUSES)[number];
  changedBy: Types.ObjectId;
  changedAt: Date;
  note?: string;
}

export interface IJobApplication extends Document {
  job: Types.ObjectId;
  team: Types.ObjectId;
  applicant: Types.ObjectId;
  resume: Types.ObjectId;
  coverLetter?: string;
  status: (typeof JOB_APPLICATION_STATUSES)[number];
  statusHistory: JobApplicationStatusHistory[];
  matchScore?: number;
  matchReasons: string[];
  createdAt: Date;
  updatedAt: Date;
}

const JobApplicationStatusHistorySchema = new Schema<JobApplicationStatusHistory>(
  {
    status: {
      type: String,
      required: true,
      enum: JOB_APPLICATION_STATUSES,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const JobApplicationSchema = new Schema<IJobApplication>(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: 'JobPost',
      required: true, 
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: 'TeamProfile',
      required: true, 
    },
    applicant: {
      type: Schema.Types.ObjectId,
      ref: 'ProfessionalProfile',
      required: true, 
    },
    resume: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeProfile',
      required: true,
    },
    coverLetter: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: JOB_APPLICATION_STATUSES,
      default: 'submitted', 
    },
    statusHistory: {
      type: [JobApplicationStatusHistorySchema],
      default: [],
    },
    matchScore: {
      type: Number,
    },
    matchReasons: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

JobApplicationSchema.index({ job: 1 });
JobApplicationSchema.index({ team: 1 });
JobApplicationSchema.index({ applicant: 1 });
JobApplicationSchema.index({ status: 1 });
JobApplicationSchema.index({ createdAt: -1 });

export const JobApplicationModel = mongoose.model<IJobApplication>('JobApplication', JobApplicationSchema);

export default JobApplicationModel;
