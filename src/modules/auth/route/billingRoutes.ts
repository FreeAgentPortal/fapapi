import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import PlanService from '../service/PlanService';
import BillingService from '../service/Billing.service';

const router = express.Router();

const service = new BillingService();


router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources);

router.use(AuthMiddleware.authorizeRoles(["*", "admin", "developer"]) as any);
router.route('/').post(service.create);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

export default router;
