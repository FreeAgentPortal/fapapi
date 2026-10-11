import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  sponsorId: { type: Schema.Types.ObjectId, required: true },
  businessName: { type: String, required: true },
  revision: { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  placementId: { type: String, required: true },
  type: { type: String, enum: ['impression', 'click'], required: true },
  receivedAt: { type: Date, required: true },
  counted: { type: Boolean, default: true },
}, { versionKey: false });
schema.index({ placementId: 1, type: 1 }, { unique: true });
schema.index({ sponsorId: 1, receivedAt: 1 });
schema.index({ sponsorId: 1, userId: 1, type: 1, receivedAt: -1 });
schema.index({ receivedAt: 1 });

export const SponsorFeedEventModel = mongoose.model('SponsorFeedEvent', schema);
