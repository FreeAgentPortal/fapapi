import { Router } from 'express';
import { AthleteActivationService } from '../services/AthleteActivationService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import asyncHandler from '../../../middleware/asyncHandler';

const router = Router();

// Admin/Developer endpoints (require admin role)
router.use(AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'developer']) as any);

// Get activation scheduler status
router.get('/activation/status', asyncHandler(AthleteActivationService.getActivationSchedulerStatus));

// Manual triggers for activation management
router.post('/activation/trigger/all', asyncHandler(AthleteActivationService.triggerProfileManagement));

router.post('/activation/trigger/deactivate', asyncHandler(AthleteActivationService.triggerDeactivation));

router.post('/activation/trigger/reactivate', asyncHandler(AthleteActivationService.triggerReactivation));

// Preview/analysis endpoints
router.get('/activation/pending-deactivation', asyncHandler(AthleteActivationService.getProfilesForDeactivation));

router.get('/activation/pending-reactivation', asyncHandler(AthleteActivationService.getProfilesForReactivation));

router.get('/activation/statistics', asyncHandler(AthleteActivationService.getActivationStatistics));

export default router;
