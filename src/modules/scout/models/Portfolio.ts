import mongoose, { Schema } from 'mongoose';

const ref = (model: string, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
const options = { timestamps: true };

const portfolioSchema = new Schema({
  athleteId: { ...ref('AthleteProfile'), unique: true },
  revision: { type: Number, default: 0 },
  version: { type: Number, default: 0 },
  sport: { type: String, default: '' },
  position: { type: String, default: '' },
  context: { type: String, default: '' },
  latestSubmission: ref('ScoutSubmission', false),
  withdrawn: { type: Boolean, default: false },
  withdrawnAt: Date,
  // All mutations take this document's write lock, including review completion.
  lock: { type: Number, default: 0 },
  storageBytes: { type: Number, default: 0 },
}, options);

const itemFields = {
  kind: { type: String, enum: ['video', 'image', 'pdf', 'text'], required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  text: String,
  url: String,
  startSeconds: Number,
  endSeconds: Number,
  order: { type: Number, default: 0 },
  assetId: ref('ScoutPortfolioAsset', false),
};
const itemSchema = new Schema({ athleteId: ref('AthleteProfile'), ...itemFields }, options);
itemSchema.index({ athleteId: 1, order: 1, _id: 1 });
itemSchema.index({ assetId: 1 });

const submissionSchema = new Schema({
  athleteId: ref('AthleteProfile'),
  version: { type: Number, required: true },
  draftRevision: { type: Number, required: true },
  sport: { type: String, required: true },
  position: { type: String, required: true },
  context: { type: String, required: true },
  athlete: { type: Schema.Types.Mixed, required: true },
  itemCount: { type: Number, required: true },
  submittedAt: { type: Date, required: true },
}, options);
submissionSchema.index({ athleteId: 1, version: 1 }, { unique: true });
submissionSchema.index({ athleteId: 1, draftRevision: 1 }, { unique: true });
const submittedItemSchema = new Schema({
  submissionId: ref('ScoutSubmission'),
  athleteId: ref('AthleteProfile'),
  itemId: ref('ScoutPortfolioItem'),
  ...itemFields,
}, options);
submittedItemSchema.index({ submissionId: 1, itemId: 1 }, { unique: true });
submittedItemSchema.index({ submissionId: 1, order: 1, _id: 1 });
submittedItemSchema.index({ assetId: 1 });

const reviewSchema = new Schema({
  submissionId: ref('ScoutSubmission'),
  athleteId: ref('AthleteProfile'),
  scoutId: ref('ScoutProfile'),
  status: { type: String, enum: ['in_progress', 'submitted', 'declined', 'cancelled'], default: 'in_progress' },
  revision: { type: Number, default: 0 },
  feedback: { type: String, default: '' },
  declineReason: String,
  reportId: ref('ScoutReport', false),
  completedAt: Date,
}, options);
reviewSchema.index({ submissionId: 1, scoutId: 1 }, { unique: true });
reviewSchema.index({ athleteId: 1, status: 1 });
reviewSchema.index({ scoutId: 1, status: 1, updatedAt: -1 });
const itemFeedbackSchema = new Schema({
  reviewId: ref('ScoutReview'),
  itemId: ref('ScoutPortfolioItem'),
  comment: { type: String, default: '' },
  unusable: { type: Boolean, default: false },
  reason: { type: String, default: '' },
}, options);
itemFeedbackSchema.index({ reviewId: 1, itemId: 1 }, { unique: true });

const assetSchema = new Schema({
  athleteId: ref('AthleteProfile'),
  fileName: { type: String, required: true },
  contentType: { type: String, required: true },
  bytes: { type: Number, required: true },
  objectKey: { type: String, required: true, unique: true },
  sha256: String,
  state: { type: String, enum: ['reserved', 'uploading', 'ready', 'deleting'], default: 'reserved' },
  expiresAt: { type: Date, required: true },
}, options);
assetSchema.index({ athleteId: 1, state: 1 });
assetSchema.index({ state: 1, expiresAt: 1 });

const eventSchema = new Schema({
  athleteId: ref('AthleteProfile'),
  actorUserId: ref('User'),
  entityId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
}, options);
eventSchema.index({ athleteId: 1, createdAt: -1 });

export const Portfolio = mongoose.model('ScoutPortfolio', portfolioSchema);
export const PortfolioItem = mongoose.model('ScoutPortfolioItem', itemSchema);
export const Submission = mongoose.model('ScoutSubmission', submissionSchema);
export const SubmittedItem = mongoose.model('ScoutSubmittedItem', submittedItemSchema);
export const Review = mongoose.model('ScoutReview', reviewSchema);
export const ItemFeedback = mongoose.model('ScoutItemFeedback', itemFeedbackSchema);
export const PortfolioAsset = mongoose.model('ScoutPortfolioAsset', assetSchema);
export const ScoutAudit = mongoose.model('ScoutAudit', eventSchema);
