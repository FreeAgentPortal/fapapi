import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import { RolesConfig } from '../../../../utils/RolesConfig';
import ProfessionalService from '../service/Professional.service';

const router = express.Router();

const service = new ProfessionalService();
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Support service is up and running',
    success: true,
  });
});

router.use(AuthMiddleware.protect);
router.route('/profile/:id').get(service.getResource);

router.route('/').post(service.create).get(service.getResources);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

router.use(AuthMiddleware.authorizeRoles(RolesConfig.getDefaultPermissionsForRole('admin')) as any);
// authenticated routes
export default router;
