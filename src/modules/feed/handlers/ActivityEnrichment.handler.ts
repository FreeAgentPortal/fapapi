import mongoose from 'mongoose';
import { IActivity } from '../model/Activity.model';
import { PostReactionModel, PostViewModel, PostShareModel, PostCommentModel } from '../model/PostInteraction.model';

/**
 * Handler for enriching activities with interaction data
 * Handles reactions, views, shares, and comments
 */
export class ActivityEnrichmentHandler {
  /**
   * Enriches activities with interaction data:
   * 1. Total counts (reactions, views, shares, comments) for ALL users
   * 2. Current user's specific interaction state (hasReacted, reactionType)
   */
  async enrichWithInteractions(activities: IActivity[], userId: string): Promise<void> {
    if (activities.length === 0) return;

    // Extract all activity IDs (these are what receive reactions, not the underlying objects)
    const activityIds = activities
      .map((activity) => activity._id)
      .filter(Boolean)
      .map((id: any) => new mongoose.Types.ObjectId(id.toString()));

    // Run all aggregations in parallel for performance
    const [reactionCounts, viewCounts, shareCounts, commentCounts, userReactions] = await Promise.all([
      this.getReactionCounts(activityIds),
      this.getViewCounts(activityIds),
      this.getShareCounts(activityIds),
      this.getCommentCounts(activityIds),
      this.getUserReactions(activityIds, userId),
    ]);

    // Create maps for quick lookup
    const reactionCountMap = new Map(reactionCounts.map((r: any) => [r._id.toString(), r.totalReactions]));
    const reactionBreakdownMap = new Map(reactionCounts.map((r: any) => [r._id.toString(), r.reactions]));
    const viewCountMap = new Map(viewCounts.map((v: any) => [v._id.toString(), v.totalViews]));
    const shareCountMap = new Map(shareCounts.map((s: any) => [s._id.toString(), s.totalShares]));
    const commentCountMap = new Map(commentCounts.map((c: any) => [c._id.toString(), c.totalComments]));
    const userReactionMap = new Map(userReactions.map((r: any) => [r.postId.toString(), r.reactionType]));

    // Enrich each activity with both total counts and user state
    for (const activity of activities) {
      const activityId = (activity._id as any).toString();
      const totalReactions = reactionCountMap.get(activityId) || 0;
      const reactions = reactionBreakdownMap.get(activityId) || [];
      const totalViews = viewCountMap.get(activityId) || 0;
      const totalShares = shareCountMap.get(activityId) || 0;
      const totalComments = commentCountMap.get(activityId) || 0;
      const userReactionType = userReactionMap.get(activityId);

      // Add interaction data to activity
      (activity as any).interactions = {
        // Total counts (visible to everyone)
        counts: {
          reactions: totalReactions,
          comments: totalComments,
          shares: totalShares,
          views: totalViews,
        },
        // Reaction breakdown by type
        reactionBreakdown: this.calculateReactionBreakdown(reactions),
        // Current user's interaction state
        userInteraction: {
          hasReacted: !!userReactionType,
          reactionType: userReactionType || null,
        },
      };
    }
  }

  /**
   * Get total reaction counts and breakdown by type for all activities
   */
  private async getReactionCounts(activityIds: mongoose.Types.ObjectId[]): Promise<any[]> {
    return await PostReactionModel.aggregate([
      { $match: { postId: { $in: activityIds } } },
      {
        $group: {
          _id: '$postId',
          totalReactions: { $sum: 1 },
          // Get breakdown by type
          reactions: {
            $push: { type: '$reactionType', userId: '$userId' },
          },
        },
      },
    ]);
  }

  /**
   * Get total view counts for all activities
   */
  private async getViewCounts(activityIds: mongoose.Types.ObjectId[]): Promise<any[]> {
    return await PostViewModel.aggregate([
      { $match: { postId: { $in: activityIds } } },
      {
        $group: {
          _id: '$postId',
          totalViews: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Get total share counts for all activities
   */
  private async getShareCounts(activityIds: mongoose.Types.ObjectId[]): Promise<any[]> {
    return await PostShareModel.aggregate([
      { $match: { postId: { $in: activityIds } } },
      {
        $group: {
          _id: '$postId',
          totalShares: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Get total comment counts for all activities
   */
  private async getCommentCounts(activityIds: mongoose.Types.ObjectId[]): Promise<any[]> {
    return await PostCommentModel.aggregate([
      {
        $match: {
          postId: { $in: activityIds },
          isDeleted: false,
          'moderation.status': { $in: ['approved', 'pending'] },
        },
      },
      {
        $group: {
          _id: '$postId',
          totalComments: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Get current user's specific reactions
   */
  private async getUserReactions(activityIds: mongoose.Types.ObjectId[], userId: string): Promise<any[]> {
    return await PostReactionModel.find({
      postId: { $in: activityIds },
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();
  }

  /**
   * Helper to calculate reaction breakdown by type
   */
  private calculateReactionBreakdown(reactions: any[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const reaction of reactions) {
      const type = reaction.type || 'like';
      breakdown[type] = (breakdown[type] || 0) + 1;
    }
    return breakdown;
  }
}
