import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import ResumeService from '../services/Resume.service';
import awardsRoutes from './awards';
import experienceRoutes from './experience';
import mediaRoutes from './media';
import qaRoutes from './qa';
import referenceRoutes from './references';

const router = express.Router();

const service = new ResumeService();

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Resume service is up and running',
    success: true,
  });
});

router.use('/awards', awardsRoutes);
router.use('/experience', experienceRoutes);
router.use('/media', mediaRoutes);
router.use('/qa', qaRoutes);
router.use('/references', referenceRoutes);

router.route('/').get(service.getResources);
router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

// authenticated routes
export default router;
