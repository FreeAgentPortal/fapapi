import mongoose, { Document, Schema } from 'mongoose';
import slugify from 'slugify';

export interface IAgentProfileOrganization {
  name?: string;
  website?: string;
}

export interface IAgentProfileLocation {
  city?: string;
  state?: string;
  country?: string;
}

export interface IAgentProfileSocialLinks {
  website?: string;
  linkedin?: string;
  x?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  links?: Map<string, string>;
}

export interface IAgentProfile extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  displayName?: string;
  agencyName?: string;
  headline?: string;
  organization?: IAgentProfileOrganization;
  avatarUrl?: string;
  email?: string;
  contactNumber?: string;
  bio?: string;
  location?: IAgentProfileLocation;
  sports: string[];
  specialties: string[];
  certifications: string[];
  socialLinks?: IAgentProfileSocialLinks;
  slug?: string;
  seatLimitOverride?: number | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentOrganizationSchema = new Schema(
  {
    name: { type: String, trim: true },
    website: { type: String, trim: true },
  },
  { _id: false }
);

const AgentLocationSchema = new Schema(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const AgentSocialLinksSchema = new Schema(
  {
    website: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    x: { type: String, trim: true },
    instagram: { type: String, trim: true },
    facebook: { type: String, trim: true },
    tiktok: { type: String, trim: true },
    youtube: { type: String, trim: true },
    links: { type: Map, of: String, default: undefined },
  },
  { _id: false }
);

const AgentProfileSchema = new Schema<IAgentProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, trim: true },
    agencyName: { type: String, trim: true },
    headline: { type: String, trim: true, maxlength: 160 },
    organization: { type: AgentOrganizationSchema },
    avatarUrl: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    contactNumber: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 1000 },
    location: { type: AgentLocationSchema },
    sports: { type: [{ type: String, trim: true }], default: [] },
    specialties: { type: [{ type: String, trim: true }], default: [] },
    certifications: { type: [{ type: String, trim: true }], default: [] },
    socialLinks: { type: AgentSocialLinksSchema },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    seatLimitOverride: { type: Number, min: 0, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AgentProfileSchema.pre<IAgentProfile>('save', function (next) {
  if (!this.slug) {
    const base = this.displayName || this.agencyName || this.organization?.name || this.email || String(this.user);
    this.slug = slugify(base, { lower: true, strict: true, trim: true });
  }
  next();
});

export const AgentProfileModel = mongoose.model<IAgentProfile>('AgentProfile', AgentProfileSchema);
