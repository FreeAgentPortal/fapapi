import express from 'express'; 
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware'; 
import AwardsService from '../services/Awards.service';
import QAService from '../services/QA.service';

const router = express.Router();

const service = new QAService(); 

router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource)
router.route("/:id/:itemId").delete(service.deleteResource);


// authenticated routes
export default router;