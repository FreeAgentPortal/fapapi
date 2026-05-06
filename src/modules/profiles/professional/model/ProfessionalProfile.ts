import mongoose, { Document, Schema } from 'mongoose';

export interface IProfessionalProfile extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  displayName?: string;
  headline?: string;
  bio?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  desiredRoles: string[];
  industries: string[];
  experienceLevel?: 'student' | 'entry' | 'mid' | 'senior' | 'executive';
  openToRelocation: boolean;
  openToRemote: boolean;
  socialLinks?: {
    linkedin?: string;
    x?: string;
    website?: string;
    links?: Map<string, string>;
  };
  jobSearchStatus: 'open' | 'casual' | 'closed';
  visibility: 'public' | 'teams_only' | 'private';
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema(
  {
    city: { type: String },
    state: { type: String },
    country: { type: String },
  },
  { _id: false }
);

const SocialLinksSchema = new Schema(
  {
    linkedin: { type: String },
    x: { type: String },
    website: { type: String },
    links: { type: Map, of: String, default: undefined },
  },
  { _id: false }
);

const ProfessionalProfileSchema = new Schema<IProfessionalProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String },
    headline: { type: String },
    bio: { type: String },
    location: { type: LocationSchema },
    desiredRoles: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    experienceLevel: {
      type: String,
      enum: ['student', 'entry', 'mid', 'senior', 'executive'],
    },
    openToRelocation: { type: Boolean, default: false },
    openToRemote: { type: Boolean, default: false },
    socialLinks: { type: SocialLinksSchema },
    jobSearchStatus: {
      type: String,
      enum: ['open', 'casual', 'closed'],
      required: true,
      default: 'open',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['public', 'teams_only', 'private'],
      required: true,
      default: 'public',
      index: true,
    },
  },
  {
    timestamps: true,
    // table name
    collection: 'professional_profiles',
  }
);

export const ProfessionalProfileModel = mongoose.model<IProfessionalProfile>('ProfessionalProfile', ProfessionalProfileSchema);
