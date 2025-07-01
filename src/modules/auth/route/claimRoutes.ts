import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import ClaimService from '../service/ClaimService';

const router = express.Router();

const service = new ClaimService();

router.route('/profile').get(service.getClaim);
router.route('/:id').get(service.getResource);


router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources).post(service.create);

router.use(AuthMiddleware.authorizeRoles(['admin', 'developer']) as any);
router.route('/').get(service.getResources).post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);
router.route('/:id/handle').post(service.handleClaim);

export default router;
