import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import FeatureService from '../service/FeatureService';

const router = express.Router();

const featureService = new FeatureService();

router.use(AuthMiddleware.protect);
router
  .route('/')
  .get(featureService.getResources)
  .post(AuthMiddleware.authorizeRoles(['*', 'developer']) as any, featureService.create);
router
  .route('/:id')
  .get(featureService.getResource)
  .put(AuthMiddleware.authorizeRoles(['*', 'developer']) as any, featureService.updateResource)
  .delete(AuthMiddleware.authorizeRoles(['*', 'developer']) as any, featureService.removeResource);

export default router;
