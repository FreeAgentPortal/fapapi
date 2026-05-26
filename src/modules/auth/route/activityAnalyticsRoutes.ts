import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { AuthActivityAnalyticsService } from '../service/AuthActivityAnalytics.service';

const router = express.Router();
const service = new AuthActivityAnalyticsService();

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['*', 'admin', 'developer']) as any);

router.route('/summary').get(service.summary);
router.route('/recent').get(service.recent);

export default router;
