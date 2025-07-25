import mongoose from 'mongoose';

export interface IRatingField {
  score: number;
  comments?: string;
}
export interface IScoutReport extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  athleteId: mongoose.Types.ObjectId;
  scoutId: mongoose.Types.ObjectId;
  sport: string;
  league: string;
  reportType: 'game' | 'evaluation' | 'camp' | 'combine' | 'interview' | 'other';
  diamondRating: number; // number set automatically by aggregation
  ratingBreakdown: Record<string, IRatingField>; // Dynamic rating fields
  observations?: string; // detailed notes on performance
  strengths?: string[]; // key strengths observed
  weaknesses?: string[]; // areas for improvement
  verifiedMetrics?: string[]; // metrics that were verified during the report
  unverifiedMetrics?: string[]; // metrics that were not verified
  recommendations?: string; // suggestions for improvement

  //metadata
  tags?: string[]; // tags for categorization
  isPublic?: boolean; // whether the report is public or private, can teams see it? or does it only affect the athlete's rating?
  isFinalized?: boolean; // whether the report is finalized or still draft
  isDraft?: boolean; // whether the report is a draft or ready to be processed

  // actionable fields
  status?: 'pending' | 'approved' | 'denied'; // current status of the report
  message?: string; // message from admin on approval/denial

  // timestamps
  createdAt: Date;
  updatedAt: Date;
}

const Schema = new mongoose.Schema(
  {
    athleteId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'Athlete',
    },
    scoutId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'Admin', // references a admin with scout role
    },
    sport: {
      type: String,
      required: true,
    },
    league: {
      type: String,
      required: true,
    },
    reportType: {
      type: String,
      enum: ['game', 'evaluation', 'camp', 'combine', 'interview', 'other'],
      required: true,
    },
    diamondRating: {
      type: Number,
      // Remove default value - will be calculated from ratingBreakdown
    },
    ratingBreakdown: {
      type: Map,
      of: {
        score: { type: Number },
        comments: { type: String },
      },
    },
    observations: {
      type: String,
    },
    strengths: {
      type: [String],
    },
    weaknesses: {
      type: [String],
    },
    verifiedMetrics: {
      type: [String],
    },
    unverifiedMetrics: {
      type: [String],
    },
    recommendations: {
      type: String,
    },
    tags: {
      type: [String],
    },
    isPublic: {
      type: Boolean,
      default: false, // default to private
    },
    isFinalized: {
      type: Boolean,
      default: false, // default to not finalized, this means the report has not been processed by an admin yet
    },
    isDraft: {
      type: Boolean,
      default: true, // default to draft
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IScoutReport>('ScoutReport', Schema);
