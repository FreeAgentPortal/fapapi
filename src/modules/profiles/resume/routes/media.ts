import express from 'express'; 
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';  
import MediaService from '../services/Media.service';

const router = express.Router();

const service = new MediaService(); 

router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);


// authenticated routes
export default router;