import mongoose, { Types } from 'mongoose';
import { ObjectId } from 'mongoose';

export interface ClaimType extends mongoose.Document {
  _id: ObjectId;
  user: Types.ObjectId; // Reference to User
  profile: Types.ObjectId; // Profile type (e.g., athlete, team, agent, scout)
  slug?: string; // Optional slug for the claim
  claimType: string; // Type of claim (e.g., 'athlete', 'team', etc.)
  message?: string; // Optional message for the claim, e.g., reason for approval or denial
  status: 'pending' | 'not started' | 'approved' | 'denied'; // Status of the claim (e.g., 'pending', 'approved', 'rejected')
  documents?: [{ url: string; fileName: string; type: string }]; // Array of documents associated with the claim
  createdAt?: Date;
  updatedAt?: Date;
}

const Schema = new mongoose.Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    profile: {
      type: Types.ObjectId,
      refPath: 'claimType', // Dynamically reference the profile type
      required: true,
    },
    claimType: {
      type: String,
      enum: ['athlete', 'team', 'agent', 'scout'],
      required: true,
    },
    slug: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'not started', 'approved', 'denied'],
      default: 'not started',
    },
    message: {
      type: String,
    },
    documents: [
      {
        url: { type: String },
        fileName: { type: String },
        type: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// TTL index for automatic deletion of claims after they havent been updated in 60 days
Schema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // 60 days
// Add a unique index on user and profile to prevent duplicate claims
Schema.index({ user: 1, profile: 1, claimType: 1 }, { unique: true, partialFilterExpression: { status: { $ne: 'denied' } } });

export default mongoose.model<ClaimType>('Claim', Schema);
