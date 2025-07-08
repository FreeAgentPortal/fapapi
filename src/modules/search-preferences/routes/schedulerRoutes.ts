import express from 'express';
import { SchedulerService } from '../services/SchedulerService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';

const router = express.Router();

// Admin-only routes for scheduler management
router.get('/status', AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'developer']) as any, SchedulerService.getSchedulerStatus);

router.post('/trigger/all', AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'developer']) as any, SchedulerService.triggerAllReports);

router.post('/trigger/:preferenceId', AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'developer']) as any, SchedulerService.triggerSpecificReport);

// User-specific routes (any authenticated user)
router.get('/preferences', AuthMiddleware.protect, SchedulerService.getUserSearchPreferences);

router.patch('/preferences/:preferenceId/schedule', AuthMiddleware.protect, SchedulerService.updateSchedulingSettings);

export default router;
