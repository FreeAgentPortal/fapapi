import mongoose, { Document, Schema } from 'mongoose';

export interface IScout extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId; // User ID of the scout
  displayName?: string; // Full name of the scout
  contactNumber?: string; // Contact number of the scout
  email?: string; // Email address of the scout
  bio?: string; // Short biography or description of the scout
  permissions?: string[]; // Array of permissions assigned to the scout
  isActive?: boolean; // Whether the scout profile is active or not, soft delete flag
  teams?: string[]; // Teams associated with the scout
  sports?: string[]; // Sports that the scout specializes in
  leagues?: string[]; // Leagues that the scout covers
  createdAt: Date; // Timestamp when the profile was created
  updatedAt: Date; // Timestamp when the profile was last updated
}

const ScoutSchema = new Schema<IScout>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String },
    contactNumber: { type: String },
    email: { type: String },
    permissions: { type: [String], default: [] }, // Permissions for the scout
    isActive: { type: Boolean, default: true }, // Soft delete flag
    bio: { type: String },
    teams: [{ type: String }],
    sports: [{ type: String }],
    leagues: [{ type: String }],
  },
  { timestamps: true }
);

export const ScoutModel = mongoose.model<IScout>('ScoutProfile', ScoutSchema);
