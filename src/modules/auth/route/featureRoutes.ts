import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import FeatureService from '../service/FeatureService';

const router = express.Router();

const featureService = new FeatureService();

router.route('/').get(featureService.getResources);

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['admin', 'developer']) as any);
router.route('/').post(featureService.create);
router.route('/:id').get(featureService.getResource).put(featureService.updateResource).delete(featureService.removeResource);

export default router;
