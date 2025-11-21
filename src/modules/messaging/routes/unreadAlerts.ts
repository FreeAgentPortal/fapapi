import { Router, Response } from 'express';
import { UnreadMessageAlertScheduler } from '../cron/UnreadMessageAlertScheduler.cron';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';

const router = Router();

/**
 * GET /api/v1/messaging/unread-alerts/status
 * Get the status of the unread message alert scheduler
 */
router.get(
  '/status',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const status = UnreadMessageAlertScheduler.getStatus();

    res.status(200).json({
      success: true,
      payload: status,
    });
  })
);

/**
 * POST /api/v1/messaging/unread-alerts/trigger
 * Manually trigger unread message alerts (for testing)
 * Optional: Pass messageId in body to test specific message
 */
router.post(
  '/trigger',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { messageId } = req.body;

    await UnreadMessageAlertScheduler.triggerManualAlerts(messageId);

    res.status(200).json({
      success: true,
      message: messageId ? `Alert triggered for message ${messageId}` : 'Alerts triggered for all unread messages older than 2 hours',
    });
  })
);

export default router;
