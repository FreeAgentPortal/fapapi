// domain/post.ts
export type ActorId = `user:${string}` | `team:${string}`;

export type MediaKind = 'image' | 'video';
export interface Media {
  kind: MediaKind;
  url: string; // canonical media URL (CDN)
  thumbUrl?: string; // for videos or large images
  width?: number;
  height?: number;
  // video only
  durationSec?: number;
  // processing pipeline metadata (non-critical)
  processing?: 'pending' | 'ready' | 'failed';
}

export interface LinkPreview {
  url: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export type Visibility = 'public' | 'followers' | 'private';

export interface Post extends mongoose.Document {
  _id: string;
  userId: string; // redundant for easy querying
  profile: {
    type: 'athlete' | 'team';
    id: string;
  };
  authorId: ActorId; // "user:..." or "team:..."
  body?: string; // markdown-lite / plain text
  sport?: string; // e.g., "football" for easy filtering
  hashtags?: string[]; // ["QB","combine"]
  mentions?: ActorId[]; // ["user:...", "team:..."]
  media?: Media[]; // images/videos
  links?: LinkPreview[]; // zero or more rich link previews
  visibility: Visibility; // default: public

  // Controls/flags
  allowComments: boolean; // default: true
  isEdited: boolean; // toggled when edit history exists
  editHistory?: { editedAt: Date; note?: string }[]; // lightweight audit

  // Soft delete & moderation
  isDeleted: boolean;
  deletedAt?: Date;
  moderation?: {
    status: 'clean' | 'flagged' | 'removed';
    reason?: string; // short label/code
    updatedAt?: Date;
  };

  // Denormalized counters (updated elsewhere)
  counts: {
    reactions: number;
    comments: number;
    shares: number;
    views: number;
  };

  createdAt: Date;
  updatedAt: Date; // last user edit (not counter bumps)
}

// models/Post.model.ts
import mongoose, { Schema, InferSchemaType, ObjectId } from 'mongoose';

const MediaSchema = new Schema(
  {
    kind: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true, trim: true },
    thumbUrl: { type: String, trim: true },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    durationSec: { type: Number, min: 0 },
    processing: { type: String, enum: ['pending', 'ready', 'failed'], default: 'ready' },
  },
  { _id: false }
);

const LinkPreviewSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    canonicalUrl: { type: String, trim: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    siteName: { type: String, trim: true },
  },
  { _id: false }
);

const EditHistorySchema = new Schema(
  {
    editedAt: { type: Date, required: true },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const PostSchema = new Schema(
  {
    authorId: { type: String, required: true, index: true }, // "user:..." | "team:..."
    body: { type: String, default: undefined },
    userId: { type: String, required: true, index: true }, // redundant for easy querying
    profile: {
      type: {
        type: String,
        enum: ['athlete', 'team'],
        required: true,
      },
      id: { type: Schema.Types.ObjectId, required: true, refPath: 'profile.type' },
    },
    sport: { type: String, index: true, default: undefined },
    hashtags: { type: [String], index: true, default: undefined },
    mentions: { type: [String], index: true, default: undefined }, // ActorId[]

    media: { type: [MediaSchema], default: undefined },
    links: { type: [LinkPreviewSchema], default: undefined },

    visibility: {
      type: String,
      enum: ['public', 'followers', 'private'],
      default: 'public',
      index: true,
    },

    allowComments: { type: Boolean, default: true },

    isEdited: { type: Boolean, default: false },
    editHistory: { type: [EditHistorySchema], default: undefined },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },

    moderation: {
      status: {
        type: String,
        enum: ['clean', 'flagged', 'removed'],
        default: 'clean',
        index: true,
      },
      reason: { type: String, trim: true },
      updatedAt: { type: Date },
    },

    counts: {
      reactions: { type: Number, default: 0, min: 0 },
      comments: { type: Number, default: 0, min: 0 },
      shares: { type: Number, default: 0, min: 0 },
      views: { type: Number, default: 0, min: 0 },
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: false,
    minimize: true,
  }
);

// Core feed index (time-ordered reads)
PostSchema.index({ createdAt: -1 });
// Useful feed filters
PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ sport: 1, createdAt: -1 });
PostSchema.index({ hashtags: 1, createdAt: -1 });
PostSchema.index({ mentions: 1, createdAt: -1 });
// Visibility + freshness
PostSchema.index({ visibility: 1, createdAt: -1 });

export type PostDoc = InferSchemaType<typeof PostSchema>;
export const PostModel = mongoose.models.Post || mongoose.model('Post', PostSchema);
