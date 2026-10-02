import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import JobSourceHandler from '../handlers/JobSourceHandler';

const router = express.Router();
const handler = new JobSourceHandler();
router.use(AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin']) as any);
router.route('/').get(handler.list).post(handler.create);
router.route('/:id').get(handler.get).patch(handler.update);
router.post('/:id/ingest', handler.ingest);
export default router;
