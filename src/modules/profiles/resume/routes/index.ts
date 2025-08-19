import express from 'express'; 
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware'; 
import ResumeService from '../services/Resume.service';

const router = express.Router();

const service = new ResumeService();
 
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Resume service is up and running',
    success: true,
  });
});

router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource);

router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);


// authenticated routes
export default router;
