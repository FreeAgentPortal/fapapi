// handlers/PostInteraction.handler.ts
import mongoose from 'mongoose';
import { PostModel } from '../model/Post.model';
import { PostReactionModel, PostViewModel, PostShareModel } from '../model/PostInteraction.model';

export class PostInteractionHandler {
  /**
   * Add or update a reaction to a post
   * Returns true if it's a new reaction, false if updated existing
   */
  async addReaction(postId: string, userId: string, reactionType: 'like' | 'love' | 'fire' | 'clap' | 'trophy' = 'like'): Promise<{ isNew: boolean; reaction: any }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Upsert the reaction (update if exists, insert if new)
      const result = await PostReactionModel.findOneAndUpdate(
        { postId: new mongoose.Types.ObjectId(postId), userId: new mongoose.Types.ObjectId(userId) },
        { reactionType },
        { upsert: true, new: true, session }
      );

      const isNew = result.createdAt.getTime() === new Date().getTime();

      // If it's a new reaction, increment the counter
      if (isNew) {
        await PostModel.findByIdAndUpdate(postId, { $inc: { 'counts.reactions': 1 } }, { session });
      }

      await session.commitTransaction();
      return { isNew, reaction: result };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Remove a reaction from a post
   */
  async removeReaction(postId: string, userId: string): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reaction = await PostReactionModel.findOneAndDelete({ postId: new mongoose.Types.ObjectId(postId), userId: new mongoose.Types.ObjectId(userId) }, { session });

      if (reaction) {
        await PostModel.findByIdAndUpdate(postId, { $inc: { 'counts.reactions': -1 } }, { session });
      }

      await session.commitTransaction();
      return !!reaction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Check if a user has reacted to a post
   */
  async hasUserReacted(postId: string, userId: string): Promise<string | null> {
    const reaction = await PostReactionModel.findOne({
      postId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    return reaction ? (reaction as any).reactionType : null;
  }

  /**
   * Record a view (idempotent - only counts unique views)
   */
  async recordView(postId: string, userId: string, viewDurationMs: number = 0): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Try to insert the view
      const result = await PostViewModel.findOneAndUpdate(
        { postId: new mongoose.Types.ObjectId(postId), userId: new mongoose.Types.ObjectId(userId) },
        { $set: { viewDurationMs }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true, session }
      );

      const isNew = result.createdAt.getTime() >= Date.now() - 1000; // within last second = new

      // If it's a new view, increment the counter
      if (isNew) {
        await PostModel.findByIdAndUpdate(postId, { $inc: { 'counts.views': 1 } }, { session });
      }

      await session.commitTransaction();
      return isNew;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Record a share
   */
  async recordShare(postId: string, userId: string, shareType: 'repost' | 'link' | 'external' = 'link', repostId?: string): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const share = await PostShareModel.create(
        [
          {
            postId: new mongoose.Types.ObjectId(postId),
            userId: new mongoose.Types.ObjectId(userId),
            shareType,
            ...(repostId && { repostId: new mongoose.Types.ObjectId(repostId) }),
          },
        ],
        { session }
      );

      await PostModel.findByIdAndUpdate(postId, { $inc: { 'counts.shares': 1 } }, { session });

      await session.commitTransaction();
      return share[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get reactions for a post (paginated)
   */
  async getPostReactions(postId: string, limit: number = 50, skip: number = 0) {
    return await PostReactionModel.find({ postId: new mongoose.Types.ObjectId(postId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  /**
   * Get reaction breakdown by type
   */
  async getReactionBreakdown(postId: string): Promise<Record<string, number>> {
    const breakdown = await PostReactionModel.aggregate([{ $match: { postId: new mongoose.Types.ObjectId(postId) } }, { $group: { _id: '$reactionType', count: { $sum: 1 } } }]);

    return breakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
  }
}
