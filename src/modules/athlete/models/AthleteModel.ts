import mongoose, { Document, Schema } from 'mongoose';

export interface IAthlete extends Document {
  userId: mongoose.Types.ObjectId;
  fullName: string;
  contactNumber: string;
  email: string;
  hometown?: string;
  birthdate?: Date;
  measurements?: Map<string, string>; // e.g., "height": "6'1\""
  metrics?: Map<string, number>;      // e.g., "dash40": 4.42
  college?: string;
  position?: string;
  highSchool?: string;
  awards?: string[];
  strengths?: string;
  weaknesses?: string;
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
      required: true,
      index: true,
      unique: true,
    },
    fullName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    hometown: { type: String },
    birthdate: { type: Date },

    measurements: {
      type: Map,
      of: String,
      default: {},
    },

    metrics: {
      type: Map,
      of: Number,
      default: {},
      validate: {
        validator: function (metrics: Map<string, number>) {
          return Array.from(metrics.values()).every(val => typeof val === 'number');
        },
        message: 'All metric values must be numbers.',
      },
    },

    college: { type: String },
    position: { type: String },
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
