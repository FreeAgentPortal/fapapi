import mongoose, { Document, Schema } from 'mongoose';

export interface IAthlete extends Document {
  _id: mongoose.Types.ObjectId;
  espnid?: string; // ESPN ID, optional for querying espn athlete data
  userId: mongoose.Types.ObjectId;
  fullName: string;
  contactNumber?: string;
  email?: string;
  birthPlace?: {
    city: string;
    state: string;
    country: string;
  };
  links?: {
    text: string;
    shortText: string;
    href: string;
    rel: string[];
    isExternal: boolean;
  }[];
  draft?: {
    year: number;
    round: number;
    pick: number;
    team: string; // Team name or ID
  };
  birthdate?: Date;
  measurements?: Map<string, string | number>; // e.g., "height": "6'1\""
  metrics?: Map<string, number>; // e.g., "dash40": 4.42
  college?: string;
  positions?: [
    {
      name: string;
      abbreviation: string;
    }
  ];
  graduationYear?: number;
  bio?: string;
  highSchool?: string;
  awards?: string[];
  strengths?: string;
  weaknesses?: string;
  experienceYears?: number; // Years of playing experience
  testimony?: string;
  profileImageUrl?: string;
  highlightVideos?: string[]; // Max 5
  diamondRating?: number; // 1–5, assigned by scouts later
  createdAt: Date;
  updatedAt: Date;
}

const AthleteSchema = new Schema<IAthlete>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    espnid: { type: String, unique: true, sparse: true }, // ESPN ID for querying athlete data
    fullName: { type: String, required: true },
    contactNumber: { type: String },
    email: { type: String, lowercase: true, trim: true },
    birthPlace: {
      city: { type: String },
      state: { type: String },
      country: { type: String },
    },
    birthdate: { type: Date },
    measurements: {
      type: Map,
      of: String || Number,
      default: {},
    },
    links: [
      {
        text: { type: String, required: true },
        shortText: { type: String, required: true },
        href: { type: String, required: true },
        rel: { type: [String], default: [] },
        isExternal: { type: Boolean, default: false },
      },
    ],
    draft: {
      year: { type: Number, min: 1900, max: new Date().getFullYear() },
      round: { type: Number, min: 1 },
      pick: { type: Number, min: 1 },
      team: { type: String }, // Team name or ID
    },
    graduationYear: { type: Number, min: 1900, max: new Date().getFullYear() },
    bio: { type: String, maxlength: 500 }, // Short bio or description
    experienceYears: { type: Number, min: 0, default: 0 },
    metrics: {
      type: Map,
      of: Number,
      default: {},
      validate: {
        validator: function (metrics: Map<string, number>) {
          return Array.from(metrics.values()).every((val) => typeof val === 'number');
        },
        message: 'All metric values must be numbers.',
      },
    },

    college: { type: String },
    positions: [
      {
        name: { type: String },
        abbreviation: { type: String },
      },
    ],
    highSchool: { type: String },
    awards: [{ type: String }],
    strengths: { type: String },
    weaknesses: { type: String },
    testimony: { type: String },

    profileImageUrl: { type: String },
    highlightVideos: {
      type: [String],
      validate: {
        validator: function (videos: string[]) {
          return videos.length <= 5;
        },
        message: 'You may upload up to 5 highlight videos only.',
      },
    },

    diamondRating: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

export const AthleteModel = mongoose.model<IAthlete>('AthleteProfile', AthleteSchema);
