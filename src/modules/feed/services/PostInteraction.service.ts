import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { PostInteractionHandler } from '../handlers/PostInteraction.handler';
import asyncHandler from '../../../middleware/asyncHandler';
import error from '../../../middleware/error';

export class PostInteractionService {
  private handler: PostInteractionHandler;

  constructor() {
    this.handler = new PostInteractionHandler();
  }

  /**
   * Add or update a reaction to a post
   * POST /posts/:postId/reactions
   * Body: { reactionType: 'like' | 'love' | 'fire' | 'clap' | 'trophy' }
   */
  public addReaction = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const { reactionType = 'like' } = req.body;
      const userId = (req as AuthenticatedRequest).user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = await this.handler.addReaction(postId, userId, reactionType);

      return res.status(result.isNew ? 201 : 200).json({
        success: true,
        message: result.isNew ? 'Reaction added' : 'Reaction updated',
        payload: result.reaction,
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  /**
   * Remove a reaction from a post
   * DELETE /posts/:postId/reactions
   */
  public removeReaction = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const userId = (req as AuthenticatedRequest).user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const removed = await this.handler.removeReaction(postId, userId);

      if (!removed) {
        return res.status(404).json({ success: false, message: 'Reaction not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Reaction removed',
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  /**
   * Check if current user has reacted to a post
   * GET /posts/:postId/reactions/me
   */
  public getMyReaction = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const userId = (req as AuthenticatedRequest).user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const reactionType = await this.handler.hasUserReacted(postId, userId);

      return res.status(200).json({
        success: true,
        payload: {
          hasReacted: !!reactionType,
          reactionType,
        },
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  /**
   * Record a view for a post
   * POST /posts/:postId/views
   * Body: { viewDurationMs?: number }
   */
  public recordView = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const { viewDurationMs = 0 } = req.body;
      const userId = (req as AuthenticatedRequest).user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const isNew = await this.handler.recordView(postId, userId, viewDurationMs);

      return res.status(200).json({
        success: true,
        message: isNew ? 'View recorded' : 'View updated',
        payload: { isNew },
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  /**
   * Record a share for a post
   * POST /posts/:postId/shares
   * Body: { shareType: 'repost' | 'link' | 'external', repostId?: string }
   */
  public recordShare = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const { shareType = 'link', repostId } = req.body;
      const userId = (req as AuthenticatedRequest).user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const share = await this.handler.recordShare(postId, userId, shareType, repostId);

      return res.status(201).json({
        success: true,
        message: 'Share recorded',
        payload: share,
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  /**
   * Get all reactions for a post (paginated)
   * GET /posts/:postId/reactions?limit=50&skip=0
   */
  public getPostReactions = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const limit = Number(req.query.limit) || 50;
      const skip = Number(req.query.skip) || 0;

      const reactions = await this.handler.getPostReactions(postId, limit, skip);

      return res.status(200).json({
        success: true,
        payload: reactions,
        metadata: {
          limit,
          skip,
          count: reactions.length,
        },
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  /**
   * Get reaction breakdown by type for a post
   * GET /posts/:postId/reactions/breakdown
   */
  public getReactionBreakdown = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;

      const breakdown = await this.handler.getReactionBreakdown(postId);

      return res.status(200).json({
        success: true,
        payload: breakdown,
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
