import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISearchPreferences extends Document {
  ownerType: 'team' | 'scout' | 'agent';
  ownerId: Types.ObjectId; // Linked to TeamProfile, ScoutProfile, etc.
  positions: string[];
  ageRange?: { min: number; max: number };
  performanceMetrics?: {
    [metric: string]: {
      min?: number;
      max?: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const SearchPreferencesSchema = new Schema<ISearchPreferences>(
  {
    ownerType: { type: String, required: true, enum: ['team', 'scout', 'agent'] },
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    positions: [{ type: String }],
    ageRange: {
      min: Number,
      max: Number,
    },
    performanceMetrics: {
      type: Map,
      of: new Schema(
        {
          min: Number,
          max: Number,
        },
        { _id: false }
      ),
    },
  },
  { timestamps: true }
);

export default mongoose.model<ISearchPreferences>('SearchPreferences', SearchPreferencesSchema);
