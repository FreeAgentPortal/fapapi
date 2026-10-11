import mongoose, { Schema } from 'mongoose';

// One durable serialization point per viewer/sponsor, shared across apps and revisions.
const schema = new Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, required: true, default: 0 },
  lastCountedAt: { type: Date, default: null },
}, { versionKey: false });

export const SponsorFeedImpressionStateModel = mongoose.model('SponsorFeedImpressionState', schema);
