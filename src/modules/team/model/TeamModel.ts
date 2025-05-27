import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITeamProfile extends Document {
  name: string;
  email: string;
  phone?: string;
  searchPreferences?: {
    positions?: string[];
    ageRange?: { min: number; max: number };
    performanceMetrics?: Record<string, number>;
  };
  linkedUsers: Types.ObjectId[]; // References to users with access
  alertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeamProfileSchema: Schema = new Schema<ITeamProfile>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      match: /^[\w.-]+@([\w-]+\.)+(edu|org|nfl)$/i,
      unique: true,
    },
    phone: { type: String },
    searchPreferences: {
      positions: [{ type: String }],
      ageRange: {
        min: { type: Number },
        max: { type: Number },
      },
      performanceMetrics: { type: Map, of: Number },
    },
    linkedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    alertsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ITeamProfile>('TeamProfile', TeamProfileSchema);
