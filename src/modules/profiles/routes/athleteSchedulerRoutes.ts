import { Router } from 'express';
import { AthleteSchedulerService } from '../services/AthleteSchedulerService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import asyncHandler from '../../../middleware/asyncHandler';

const router = Router();

router.use(AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'developer']) as any);
// Admin/Developer endpoints (require admin role)
router.get('/scheduler/status', asyncHandler(AthleteSchedulerService.getSchedulerStatus));

router.post('/scheduler/trigger/all', asyncHandler(AthleteSchedulerService.triggerAllCompletionAlerts));

router.post('/scheduler/trigger/:athleteId', asyncHandler(AthleteSchedulerService.triggerSpecificCompletionAlert));

router.get('/scheduler/incomplete', asyncHandler(AthleteSchedulerService.getIncompleteProfiles));

router.get('/scheduler/statistics', asyncHandler(AthleteSchedulerService.getCompletionStatistics));

// Individual athlete endpoints (athletes can check their own completion status)
router.get(
  '/completion-report/:athleteId',
  AuthMiddleware.authorizeRoles(['admin', 'developer', 'athlete']) as any,
  asyncHandler(AthleteSchedulerService.getAthleteCompletionReport)
);

export default router;
