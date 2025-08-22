import express from 'express'; 
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware'; 
import EducationService from '../services/Education.service';

const router = express.Router();

const service = new EducationService(); 

router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource)
router.route("/:id/:itemId").delete(service.deleteResource);


// authenticated routes
export default router;