import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { UserService } from '../service/User.service';

const router = express.Router();

const service = new UserService();

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'User service is up and running',
    success: true,
  });
});

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['*', 'admin', 'moderator', 'developer', 'support']) as any);
router.route('/').post(service.create).get(service.getResources);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);
router.route('/:id/reset-password').post(service.updatePassword);

// authenticated routes
export default router;
