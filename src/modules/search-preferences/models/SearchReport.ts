import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISearchReport extends Document {
  _id: Types.ObjectId;
  searchPreference: Types.ObjectId; // Reference to the search preference
  // results can be an empty array if no athletes match the search criteria
  results: Types.ObjectId[]; // Array of athlete IDs that match the search
  generatedAt: Date; // When the report was generated
  reportId: string; // Unique identifier for the report
  ownerId: Types.ObjectId; // Reference to the resource owner (team/scout/agent etc.)
  ownerType: 'team' | 'scout' | 'agent'; // Type of the owner
  opened: boolean; // Whether the report has been opened by the user
  createdAt: Date;
  updatedAt: Date;
}

const SearchReportSchema = new Schema<ISearchReport>(
  {
    searchPreference: { type: Schema.Types.ObjectId, ref: 'SearchPreference', required: true },
    results: [{ type: Schema.Types.ObjectId, ref: 'Athlete' }],
    generatedAt: { type: Date, default: Date.now },
    reportId: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ownerType: { type: String, enum: ['team', 'scout', 'agent'], required: true },
    opened: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<ISearchReport>('SearchReport', SearchReportSchema);
