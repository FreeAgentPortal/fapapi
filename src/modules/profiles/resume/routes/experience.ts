import express from 'express'; 
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware'; 
import ExperienceService from '../services/Experience.service';

const router = express.Router();

const service = new ExperienceService(); 

router.use(AuthMiddleware.protect);
router.route('/:id').put(service.updateResource).delete(service.removeResource);


// authenticated routes
export default router;