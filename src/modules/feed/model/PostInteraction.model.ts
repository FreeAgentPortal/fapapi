// models/PostInteraction.model.ts
import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * PostReaction - Tracks who reacted to a post and with what type
 * Keeps Post.counts.reactions as a denormalized counter
 */
const PostReactionSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Post' },
    userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    reactionType: {
      type: String,
      enum: ['like', 'love', 'fire', 'clap', 'trophy'],
      default: 'like',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Compound index: one user can only have one reaction per post (upsert pattern)
PostReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });

export type PostReactionDoc = InferSchemaType<typeof PostReactionSchema>;
export const PostReactionModel = mongoose.models.PostReaction || mongoose.model('PostReaction', PostReactionSchema);

/**
 * PostView - Tracks unique views of a post
 * Keeps Post.counts.views as a denormalized counter
 */
const PostViewSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Post' },
    userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    // Optional: track how long they viewed, if they scrolled, etc.
    viewDurationMs: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Compound index: track unique views per user
PostViewSchema.index({ postId: 1, userId: 1 }, { unique: true });
// TTL index: delete view records after 90 days to keep collection size manageable
PostViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export type PostViewDoc = InferSchemaType<typeof PostViewSchema>;
export const PostViewModel = mongoose.models.PostView || mongoose.model('PostView', PostViewSchema);

/**
 * PostShare - Tracks who shared a post and where
 * Keeps Post.counts.shares as a denormalized counter
 */
const PostShareSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Post' },
    userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    shareType: {
      type: String,
      enum: ['repost', 'link', 'external'], // repost to feed, copy link, share outside platform
      default: 'repost',
    },
    // If it's a repost, this is the new post ID
    repostId: { type: Schema.Types.ObjectId, ref: 'Post' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

PostShareSchema.index({ postId: 1, userId: 1, createdAt: -1 });
PostShareSchema.index({ userId: 1, createdAt: -1 }); // user's share history

export type PostShareDoc = InferSchemaType<typeof PostShareSchema>;
export const PostShareModel = mongoose.models.PostShare || mongoose.model('PostShare', PostShareSchema);

/**
 * PostComment - Tracks comments on posts
 * Keeps Post.counts.comments as a denormalized counter
 * Stores snapshot data (avatarUrl, name) to prevent broken references if profile is deleted
 */
const PostCommentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Post' },
    userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    profile: {
      type: {
        type: String,
        enum: ['AthleteProfile', 'TeamProfile'],
        required: true,
      },
      id: { type: Schema.Types.ObjectId, required: true, refPath: 'profile.type' },
    },

    // Content
    content: { type: String, required: true, trim: true, maxlength: 5000 },

    // Snapshot data - preserved even if profile is deleted
    authorName: { type: String, required: true },
    authorAvatarUrl: { type: String, default: '' },

    // Moderation
    moderation: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'flagged', 'removed'],
        default: 'approved',
        index: true,
      },
      flaggedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      flagReason: { type: String },
      moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      moderatedAt: { type: Date },
    },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for querying
PostCommentSchema.index({ postId: 1, createdAt: -1 }); // get comments for a post, newest first
PostCommentSchema.index({ userId: 1, createdAt: -1 }); // user's comment history
PostCommentSchema.index({ profileId: 1, createdAt: -1 }); // profile's comment history
PostCommentSchema.index({ 'moderation.status': 1, createdAt: -1 }); // moderation queue

export type PostCommentDoc = InferSchemaType<typeof PostCommentSchema>;
export const PostCommentModel = mongoose.models.PostComment || mongoose.model('PostComment', PostCommentSchema);
