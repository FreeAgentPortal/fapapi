import mongoose, { Types } from 'mongoose';
import { ObjectId } from 'mongoose';

export interface ClaimType extends mongoose.Document {
  _id: ObjectId;
  user: Types.ObjectId; // Reference to User
  profile: Types.ObjectId; // Profile type (e.g., athlete, team, agent, scout)
  claimType: string; // Type of claim (e.g., 'athlete', 'team', etc.)
  status: 'pending' | 'not started' | 'completed'; // Status of the claim (e.g., 'pending', 'approved', 'rejected')
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
    status: {
      type: String,
      enum: ['pending', 'not started', 'completed'],
      default: 'not started',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ClaimType>('Claim', Schema);
