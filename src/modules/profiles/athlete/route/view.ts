import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import ViewService from '../service/ViewService';

const router = express.Router();
const service = new ViewService();

router.use(AuthMiddleware.protect);
router.route('/:id').post(service.trackView).get(service.getViewStats);

// authenticated routes
export default router;
