import mongoose, { Document, Schema } from 'mongoose';

export interface IAthleteView extends Document {
  _id: mongoose.Types.ObjectId;
  athleteId: mongoose.Types.ObjectId;
  viewerId: mongoose.Types.ObjectId; // The user who viewed the profile (auth user ID)
  viewerProfileId: mongoose.Types.ObjectId; // The profile ID that viewed (e.g., team profile, scout profile)
  viewerType: 'team' | 'athlete' | 'admin' | 'scout' | 'resume'; // Type of viewer profile
  viewerDetails?: {
    organizationName?: string; // Team name, agency name, etc.
    position?: string; // Coach, General Manager, Agent, etc.
    department?: string; // Scouting, Recruitment, etc.
  };
  sessionId?: string; // To track unique sessions
  ipAddress?: string; // For additional tracking/analytics
  userAgent?: string; // Browser/device information
  referrer?: string; // Where they came from
  viewDuration?: number; // Time spent on profile (in seconds)
  createdAt: Date;
  updatedAt: Date;
}

const AthleteViewSchema = new Schema<IAthleteView>(
  {
    athleteId: {
      type: Schema.Types.ObjectId,
      ref: 'AthleteProfile',
      required: true,
      index: true,
    },
    viewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    viewerProfileId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      // Dynamic ref will be set based on viewerType
    },
    viewerType: {
      type: String,
      enum: ['team', 'athlete', 'admin', 'scout', 'resume'],
      required: true,
      index: true,
    },
    viewerDetails: {
      organizationName: { type: String },
      position: { type: String },
      department: { type: String },
    },
    sessionId: {
      type: String,
      index: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    referrer: { type: String },
    viewDuration: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'athlete_views',
  }
);

// TTL index for automatic 60-day expiration
AthleteViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 }); // 60 days

// Compound indexes for efficient querying
AthleteViewSchema.index({ athleteId: 1, viewerProfileId: 1, createdAt: -1 });
AthleteViewSchema.index({ athleteId: 1, viewerType: 1, createdAt: -1 });
AthleteViewSchema.index({ viewerId: 1, createdAt: -1 });
AthleteViewSchema.index({ viewerProfileId: 1, createdAt: -1 });
AthleteViewSchema.index({ createdAt: -1 });

export const AthleteViewModel = mongoose.model<IAthleteView>('AthleteView', AthleteViewSchema);
