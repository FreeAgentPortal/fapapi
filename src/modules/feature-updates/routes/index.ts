import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { FeatureUpdateHandler } from '../handlers/FeatureUpdateHandler';

const router = express.Router();
const handler = new FeatureUpdateHandler();

router.get('/public', handler.publicConfig);

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['admin']) as express.RequestHandler);
router.get('/admin/portals', handler.portals);
router.put('/admin/portals/:portal', handler.savePortalTitle);
router.route('/admin').get(handler.list).post(handler.create);
router.route('/admin/:id').get(handler.get).patch(handler.update).delete(handler.remove);

export default router;
