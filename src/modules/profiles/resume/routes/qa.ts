import express from 'express'; 
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware'; 
import AwardsService from '../services/Awards.service';
import QAService from '../services/QA.service';

const router = express.Router();

const service = new QAService(); 

router.use(AuthMiddleware.protect);
router.route('/:id').put(service.updateResource).delete(service.removeResource);


// authenticated routes
export default router;