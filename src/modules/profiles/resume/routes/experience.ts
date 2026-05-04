import express from 'express'; 
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware'; 
import ExperienceService from '../services/Experience.service';

const router = express.Router();

const service = new ExperienceService(); 

router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource)
router.route("/:id/:itemId").delete(service.deleteResource);


// authenticated routes
export default router;