import mongoose, { Document, Schema } from 'mongoose';
import slugify from 'slugify';

export interface IAgentProfile extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  displayName?: string;
  agencyName?: string;
  avatarUrl?: string;
  email?: string;
  contactNumber?: string;
  bio?: string;
  slug?: string;
  seatLimitOverride?: number | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentProfileSchema = new Schema<IAgentProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, trim: true },
    agencyName: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    contactNumber: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 1000 },
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
    const base = this.displayName || this.agencyName || this.email || String(this.user);
    this.slug = slugify(base, { lower: true, strict: true, trim: true });
  }
  next();
});

export const AgentProfileModel = mongoose.model<IAgentProfile>('AgentProfile', AgentProfileSchema);
