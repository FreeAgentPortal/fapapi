import mongoose, { Schema, Document } from 'mongoose';

/**
 * Interface for Signing document
 * Tracks verified athlete signings to teams
 */
export interface ISigning extends Document {
  athlete: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  signedDate: Date;
  admin: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema for tracking verified athlete-team signings
 * Created and managed from admin dashboard
 */
const SigningSchema = new Schema<ISigning>(
  {
    athlete: {
      type: Schema.Types.ObjectId,
      ref: 'AthleteProfile',
      required: true,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: 'TeamProfile',
      required: true,
    },
    signedDate: {
      type: Date,
      required: true,
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate signings
SigningSchema.index({ athlete: 1, team: 1, signedDate: 1 }, { unique: true });

export const SigningModel = mongoose.model<ISigning>('Signing', SigningSchema);
