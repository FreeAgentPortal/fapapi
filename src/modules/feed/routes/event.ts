import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware'; 
import { EventService } from '../services/Event.service';

const router = express.Router();

const service = new EventService();
 

router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource);

// authenticated routes
router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);

export default router;
