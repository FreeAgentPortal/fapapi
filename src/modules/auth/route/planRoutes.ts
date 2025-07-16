import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import PlanService from '../service/PlanService';

const router = express.Router();

const planService = new PlanService();

router.route('/').get(planService.getResources);

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(["*", "admin", "developer"]) as any);
router.route('/').post(planService.create);
router.route('/:id').get(planService.getResource).put(planService.updateResource).delete(planService.removeResource);

export default router;
