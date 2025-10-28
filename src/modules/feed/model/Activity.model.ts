// models/Activity.model.ts
import mongoose, { Schema, InferSchemaType } from 'mongoose';

export type ActivityCollection = 'events' | 'posts' | 'users' | 'teams' | string;

export type ActivityRef = { collection: ActivityCollection; id: string };

export interface IActivity extends mongoose.Document {
  verb: string; // e.g., "created", "joined", "liked"
  actorId: string; // e.g., "team:abc" or "user:123"
  object: ActivityRef; // pointer to canonical doc
  visibility: 'public'; // MVP
  summary?: string;
  thumbUrl?: string;
  sport?: string;
  tags?: string[];
  idempotencyKey?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ActivityRefSchema = new Schema<ActivityRef>(
  {
    collection: { type: String, required: true, trim: true },
    id: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ActivitySchema = new Schema(
  {
    verb: {
      type: String,
      required: true,
    },
    actorId: { type: String, required: true, index: true },
    object: { type: ActivityRefSchema, required: true },

    // optional immutable render hints
    summary: { type: String, default: undefined },
    thumbUrl: { type: String, default: undefined },

    sport: { type: String, index: true, default: undefined },
    tags: { type: [String], index: true, default: undefined },

    visibility: {
      type: String,
      enum: ['public', 'private', 'friends-only', 'athletes-only', 'team-only'],
      default: 'public',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    minimize: true,
  }
);

// Core time index (descending reads)
ActivitySchema.index({ createdAt: -1 });
// Common compound queries
ActivitySchema.index({ verb: 1, createdAt: -1 });
ActivitySchema.index({ 'object.collection': 1, 'object.id': 1 });
ActivitySchema.index({ sport: 1, createdAt: -1 });

// TTL index: auto-delete activities after 1 year (31536000 seconds)
// MongoDB will delete documents ~60s after expiration
// Social feed activities older than 1 year are typically not relevant
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export type ActivityDoc = InferSchemaType<typeof ActivitySchema>;
export const ActivityModel = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
