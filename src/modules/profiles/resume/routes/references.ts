import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import ReferencesService from '../services/References.service';

const router = express.Router();

const service = new ReferencesService();

router.use(AuthMiddleware.protect);
router.route('/:id').put(service.updateResource).delete(service.removeResource);

// authenticated routes
export default router;
