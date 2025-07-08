import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISearchPreferences extends Document {
  ownerType: 'team' | 'scout' | 'agent';
  name: string; // Optional name for the search preferences
  description?: string; // Optional description for the search preferences
  tags?: string[]; // Optional tags for categorization
  // frequency and frequncyType,
  frequency?: number; // Optional frequency for updates
  frequencyType?: 'daily' | 'weekly' | 'monthly'; // Optional frequency type
  numberOfResults?: number; // Optional number of results to return
  dateLastRan?: Date; // Optional date when the search was last run
  ownerId: Types.ObjectId; // Linked to TeamProfile, ScoutProfile, etc.
  positions?: string[]; // Array of positions to filter athletes
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
    name: { type: String, required: true },
    description: { type: String },
    tags: [{ type: String }],
    frequency: { type: Number, default: 0 }, // Default to 0 if not specified
    frequencyType: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    numberOfResults: { type: Number },
    dateLastRan: { type: Date },
    ageRange: {
      min: Number,
      max: Number,
    },
    positions: [{ type: String }], // Array of positions to filter athletes
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
