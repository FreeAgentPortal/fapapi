import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITeamProfile extends Document {
  name: string;
  email?: string;
  phone?: string;
  slug?: string; // Optional slug for URL-friendly team name
  abbreviation?: string; // e.g., "SF" for San Francisco 49ers
  shortDisplayName?: string; // e.g., "49ers"
  positionsNeeded?: string[]; // e.g., ["QB", "WR", "OL"]
  color: string; // e.g., "#AA0000" for team color
  alternateColor?: string; // e.g., "#FFFFFF" for alternate color
  isActive?: boolean; // Whether the team is currently active
  isAllStar?: boolean; // Whether the team is an All-Star team
  logos?: [{ href: string; alt: string; width: number; height: number }]; // Array of logo objects with href and alt text
  links?: [{ language: string; href: string; text: string; shortText: string }];
  location: string; // e.g., "CA", "TX"
  linkedUsers: Types.ObjectId[]; // References to users with access
  alertsEnabled: boolean;
  verifiedDomain?: string; // e.g., "example.edu"
  openToTryouts?: boolean; // Whether the team is open to new athletes
  createdAt: Date;
  updatedAt: Date;
}

const TeamProfileSchema: Schema = new Schema<ITeamProfile>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      // match: /^[\w.-]+@([\w-]+\.)+(edu|org|nfl)$/i,
    },
    phone: { type: String },
    linkedUsers: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, role: { type: String, enum: ['admin', 'member'], default: 'member' } }],
    alertsEnabled: { type: Boolean, default: true },
    positionsNeeded: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      required: true,
    },
    verifiedDomain: {
      type: String,
      match: /^[\w.-]+\.(edu|org|nfl)$/,
      default: null, // Optional field
    },
    openToTryouts: { type: Boolean, default: true }, // Whether the team is open to new athletes
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true, // Allows for null values
    },
    abbreviation: {
      type: String,
      trim: true,
    },
    shortDisplayName: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      match: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, // Hex color format
    },
    alternateColor: {
      type: String,
      match: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, // Optional hex color format
    },
    isActive: { type: Boolean, default: true }, // Whether the team is currently active
    isAllStar: { type: Boolean, default: false }, // Whether the team is an All-Star team
    logos: [
      {
        href: { type: String, required: true },
        alt: { type: String },
        width: { type: Number },
        height: { type: Number },
      },
    ],
    links: [
      {
        language: { type: String },
        href: { type: String, required: true },
        text: { type: String, required: true },
        shortText: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<ITeamProfile>('TeamProfile', TeamProfileSchema);
