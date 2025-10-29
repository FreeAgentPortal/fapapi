import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware'; 
import { ActivityService } from '../services/Activity.service';

const router = express.Router();

const service = new ActivityService();
 

router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource);

router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource); 
export default router;
