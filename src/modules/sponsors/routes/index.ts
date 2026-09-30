import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { SponsorService } from '../services/SponsorService';

const router = express.Router();
const service = new SponsorService();

router.get('/public', service.getVisible);

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['admin']) as any);
router.route('/').get(service.getResources).post(service.create);
router.route('/:id').get(service.getResource).put(service.updateResource).patch(service.updateResource).delete(service.removeResource);

export default router;
