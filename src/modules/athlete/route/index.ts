import express from 'express';
import AthleteService from '../service/AthleteService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import profileRoutes from './profileRoutes';

const router = express.Router();

const service = new AthleteService();

router.use('/profile', profileRoutes);

router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource);

router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

// authenticated routes
export default router;
