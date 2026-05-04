import { Request, Response } from 'express';
import { CRUDService } from '../../../utils/baseCRUD';
import CommentHandler from '../handlers/CommentInteraction.handler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { PostModel } from '../model/Post.model';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { ActivityModel } from '../model/Activity.model';

export default class CommentInteractionService extends CRUDService {
  protected handler: CommentHandler;

  constructor() {
    super(CommentHandler);
    this.handler = new CommentHandler();
  }

  /**
   * Get all comments for a post
   * GET /post/:postId/comments
   */
  public getResources = async (req: Request, res: Response): Promise<Response> => {
    try {
      this.ensureAuthenticated(req as AuthenticatedRequest, 'getResources');
      const pageSize = Number(req.query?.pageLimit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      // Generate the keyword query
      const keywordQuery = AdvFilters.query(this.queryKeys, req.query?.keyword as string);

      // Generate the filter options for inclusion if provided
      const filterIncludeOptions = AdvFilters.filter(req.query?.includeOptions as string);

      // Construct the `$or` array conditionally
      const orConditions = [
        ...(Object.keys(keywordQuery[0]).length > 0 ? keywordQuery : []),
        ...(Array.isArray(filterIncludeOptions) && filterIncludeOptions.length > 0 && Object.keys(filterIncludeOptions[0]).length > 0 ? filterIncludeOptions : []), // Only include if there are filters
      ];

      const [result] = await this.handler.getPostComments(req.params.postId, {
        filters: AdvFilters.filter(req.query?.filterOptions as string),
        sort: AdvFilters.sort((req.query?.sortOptions as string) || '-createdAt'),
        query: orConditions,
        page,
        limit: pageSize,
      });
      return res.status(200).json({
        success: true,
        payload: [...result.entries],
        metadata: {
          page,
          pages: Math.ceil(result.metadata[0]?.totalCount / pageSize) || 0,
          totalCount: result.metadata[0]?.totalCount || 0,
          prevPage: page - 1,
          nextPage: page + 1,
        },
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  };

  /**
   * Create a new comment on a post
   * POST /post/:postId/comments
   */
  public createComment = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const { content, profileId, profileType } = req.body;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?._id;

      if (!userId || !profileId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated or profileId missing',
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Comment content is required',
        });
      }

      const post = await ActivityModel.findById(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      const authorName = authReq.user.fullName.trim();
      const authorAvatarUrl = authReq.user.profileImageUrl || '';

      const comment = await this.handler.createComment({ 
        profileType,
        postId,
        userId,
        profileId,
        content: content.trim(),
        authorName,
        authorAvatarUrl,
      });

      await ActivityModel.findByIdAndUpdate(postId, {
        $inc: { 'counts.comments': 1 },
      });

      return res.status(201).json({
        success: true,
        message: 'Comment created successfully',
        data: comment,
      });
    } catch (err) {
      console.error('[CommentInteractionService] Error creating comment:', err);
      return error(err, req, res);
    }
  });

  /**
   * Update a comment
   * PUT /post/:postId/comments/:commentId
   */
  public updateComment = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Comment content is required',
        });
      }

      const comment = await this.handler.updateComment(commentId, userId, content.trim());

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found or you do not have permission to edit it',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Comment updated successfully',
        data: comment,
      });
    } catch (err) {
      console.error('[CommentInteractionService] Error updating comment:', err);
      return error(err, req, res);
    }
  });

  /**
   * Delete a comment (soft delete)
   * DELETE /post/:postId/comments/:commentId
   */
  public deleteComment = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId, commentId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const comment = await this.handler.deleteComment(commentId, userId);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found or you do not have permission to delete it',
        });
      }

      await PostModel.findByIdAndUpdate(postId, {
        $inc: { 'counts.comments': -1 },
      });

      return res.status(200).json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (err) {
      console.error('[CommentInteractionService] Error deleting comment:', err);
      return error(err, req, res);
    }
  });

  /**
   * Get a single comment
   * GET /post/:postId/comments/:commentId
   */
  public getComment = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;

      const comment = await this.handler.getComment(commentId);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: comment,
      });
    } catch (err) {
      console.error('[CommentInteractionService] Error getting comment:', err);
      return error(err, req, res);
    }
  });

  /**
   * Flag a comment for moderation
   * POST /post/:postId/comments/:commentId/flag
   */
  public flagComment = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const { reason } = req.body;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Flag reason is required',
        });
      }

      const comment = await this.handler.flagComment(commentId, userId, reason.trim());

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Comment flagged for moderation',
      });
    } catch (err) {
      console.error('[CommentInteractionService] Error flagging comment:', err);
      return error(err, req, res);
    }
  });
}
