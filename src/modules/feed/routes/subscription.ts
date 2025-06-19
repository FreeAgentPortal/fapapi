import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import SubscriptionService from '../services/SubscriptionService';

const router = express.Router();

const service = new SubscriptionService();

router.route('/toggle').post(service.subscribe);

router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource);

// authenticated routes
router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);

export default router;
