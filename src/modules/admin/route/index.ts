import express from 'express';
import AdminService from '../service/AdminService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';

const router = express.Router();

const service = new AdminService();

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Support service is up and running',
    success: true,
  });
});

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['*', 'admin', 'moderator', 'developer', 'support']) as any);
router.route('/profile/:id').get(service.getResource);

router.route('/').post(service.create).get(service.getResources);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

// authenticated routes
export default router;
