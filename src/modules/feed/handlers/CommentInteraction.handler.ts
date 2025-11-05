import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { PostCommentDoc, PostCommentModel } from '../model/PostInteraction.model';
import mongoose, { Document } from 'mongoose';

export default class CommentHandler extends CRUDHandler<PostCommentDoc & Document> {
  constructor() {
    super(PostCommentModel);
  }

  /**
   * Get all comments for a specific post
   */
  async getPostComments(postId: string, options: PaginationOptions): Promise<{ entries: any[]; metadata: any[] }[]> {
    const matchStage = {
      postId: new mongoose.Types.ObjectId(postId),
      isDeleted: false,
      'moderation.status': { $in: ['approved', 'pending'] },
      $and: [...options.filters],
      ...(options.query.length > 0 && { $or: options.query }),
    };

    // Get total count
    const totalCount = await this.Schema.countDocuments(matchStage);

    // Get paginated comments with profile populated
    const comments = await this.Schema.find(matchStage)
      .sort(options.sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate('profile.id', '_id fullName profileImageUrl') // Only select specific fields
      .lean();

    return [
      {
        metadata: [{ totalCount, page: options.page, limit: options.limit }],
        entries: comments,
      },
    ];
  }

  /**
   * Create a new comment on a post
   */
  async createComment(data: {
    postId: string;
    userId: string;
    profileType: 'athlete' | 'team';
    profileId: string;
    content: string;
    authorName: string;
    authorAvatarUrl?: string;
  }): Promise<PostCommentDoc & Document> {
    const comment = await this.Schema.create({
      postId: data.postId,
      userId: data.userId,
      profile: {
        type: data.profileType,
        id: data.profileId,
      },
      content: data.content,
      authorName: data.authorName,
      authorAvatarUrl: data.authorAvatarUrl || '',
      moderation: {
        status: 'approved', // Auto-approve by default
      },
    });

    return comment;
  }

  /**
   * Update a comment (only content can be updated)
   */
  async updateComment(commentId: string, userId: string, content: string): Promise<(PostCommentDoc & Document) | null> {
    const comment = await this.Schema.findOneAndUpdate(
      {
        _id: commentId,
        userId: userId, // Ensure user owns the comment
        isDeleted: false,
      },
      {
        content: content,
        updatedAt: new Date(),
      },
      { new: true }
    );

    return comment;
  }

  /**
   * Soft delete a comment
   */
  async deleteComment(commentId: string, userId: string): Promise<(PostCommentDoc & Document) | null> {
    const comment = await this.Schema.findOneAndUpdate(
      {
        _id: commentId,
        userId: userId, // Ensure user owns the comment
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true }
    );

    return comment;
  }

  /**
   * Get a single comment by ID
   */
  async getComment(commentId: string): Promise<(PostCommentDoc & Document) | null> {
    const comment = await this.Schema.findOne({
      _id: commentId,
      isDeleted: false,
    })
      .populate('profile.id', '_id fullName profileImageUrl') // Only select specific fields
      .lean();

    return comment as (PostCommentDoc & Document) | null;
  }

  /**
   * Flag a comment for moderation
   */
  async flagComment(commentId: string, userId: string, reason: string): Promise<(PostCommentDoc & Document) | null> {
    const comment = await this.Schema.findOneAndUpdate(
      {
        _id: commentId,
        isDeleted: false,
      },
      {
        $set: {
          'moderation.status': 'flagged',
          'moderation.flagReason': reason,
        },
        $addToSet: {
          'moderation.flaggedBy': userId,
        },
      },
      { new: true }
    );

    return comment;
  }

  /**
   * Get comment count for a post
   */
  async getCommentCount(postId: string): Promise<number> {
    const count = await this.Schema.countDocuments({
      postId: postId,
      isDeleted: false,
      'moderation.status': { $in: ['approved', 'pending'] },
    });

    return count;
  }
}
