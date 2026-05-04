import express from 'express';
import LegalService from '../service/LegalService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
const router = express.Router();

const service = new LegalService();

router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource); 

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['admin', 'superadmin', 'legal']) as any);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);

export default router;
