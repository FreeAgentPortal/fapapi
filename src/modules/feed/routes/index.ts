import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import SubscriptionService from '../services/SubscriptionService';
import FeedService from '../services/FeedService';
import subscriptionRouter from './subscription';

const router = express.Router();

const service = new FeedService();

router.use('/subscription', subscriptionRouter)
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Feed service is up and running',
    success: true,
  });
});

// router.route('/').get(service.getResources);
// router.route('/:id').get(service.getResource);

router.use(AuthMiddleware.protect);
// router.route('/').post(service.create);
// router.route('/:id').put(service.updateResource).delete(service.removeResource);

// authenticated routes
export default router;
