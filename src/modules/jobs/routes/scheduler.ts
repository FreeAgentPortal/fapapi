import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { JobSchedulerService } from '../services/JobSchedulerService';

const router = express.Router();
const service = new JobSchedulerService();

router.use(AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin']) as any);

router.post('/trigger/expiration', service.triggerExpiration);
router.get('/status', service.getStatus);

export default router;
