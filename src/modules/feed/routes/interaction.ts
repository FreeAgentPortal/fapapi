import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { PostInteractionService } from '../services/PostInteraction.service';
import CommentInteractionService from '../services/CommentInteraction.service';

const router = express.Router();

const service = new PostInteractionService();
const commentService = new CommentInteractionService();

// All routes require authentication
router.use(AuthMiddleware.protect);

// ========== REACTION ROUTES ==========

/**
 * @route   POST /api/v1/posts/:postId/reactions
 * @desc    Add or update a reaction to a post
 * @access  Private
 * @body    { reactionType: 'like' | 'love' | 'fire' | 'clap' | 'trophy' }
 */
router.post('/:postId/reactions', service.addReaction);

/**
 * @route   DELETE /api/v1/posts/:postId/reactions
 * @desc    Remove current user's reaction from a post
 * @access  Private
 */
router.delete('/:postId/reactions', service.removeReaction);

/**
 * @route   GET /api/v1/posts/:postId/reactions/me
 * @desc    Check if current user has reacted to a post
 * @access  Private
 */
router.get('/:postId/reactions/me', service.getMyReaction);

/**
 * @route   GET /api/v1/posts/:postId/reactions
 * @desc    Get all reactions for a post (paginated)
 * @access  Private
 * @query   limit, skip
 */
router.get('/:postId/reactions', service.getPostReactions);

/**
 * @route   GET /api/v1/posts/:postId/reactions/breakdown
 * @desc    Get reaction breakdown by type
 * @access  Private
 */
router.get('/:postId/reactions/breakdown', service.getReactionBreakdown);

// ========== VIEW ROUTES ==========

/**
 * @route   POST /api/v1/posts/:postId/views
 * @desc    Record a view for a post
 * @access  Private
 * @body    { viewDurationMs?: number }
 */
router.post('/:postId/view', service.recordView);

// ========== SHARE ROUTES ==========

/**
 * @route   POST /api/v1/posts/:postId/shares
 * @desc    Record a share for a post
 * @access  Private
 * @body    { shareType: 'repost' | 'link' | 'external', repostId?: string }
 */
router.post('/:postId/shares', service.recordShare);

// ========== COMMENT ROUTES ==========

/**
 * @route   GET /api/v1/post/:postId/comments
 * @desc    Get all comments for a post (paginated)
 * @access  Public
 * @query   page, limit
 */
router.get('/:postId/comments', commentService.getResources);

/**
 * @route   POST /api/v1/post/:postId/comments
 * @desc    Add a comment to a post
 * @access  Private
 * @body    { content: string, profileId: string }
 */
router.post('/:postId/comments', commentService.createComment);

/**
 * @route   GET /api/v1/post/:postId/comments/:commentId
 * @desc    Get a single comment
 * @access  Public
 */
router.get('/:postId/comments/:commentId', commentService.getComment);

/**
 * @route   PUT /api/v1/post/:postId/comments/:commentId
 * @desc    Update a comment (owner only)
 * @access  Private
 * @body    { content: string }
 */
router.put('/:postId/comments/:commentId', commentService.updateComment);

/**
 * @route   DELETE /api/v1/post/:postId/comments/:commentId
 * @desc    Delete a comment (owner only)
 * @access  Private
 */
router.delete('/:postId/comments/:commentId', commentService.deleteComment);

/**
 * @route   POST /api/v1/post/:postId/comments/:commentId/flag
 * @desc    Flag a comment for moderation
 * @access  Private
 * @body    { reason: string }
 */
router.post('/:postId/comments/:commentId/flag', commentService.flagComment);

export default router;
