import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import ProfileService from '../service/ProfileService';

const router = express.Router();

const service = new ProfileService();

router.use(AuthMiddleware.protect);
router.route('/:id').get(service.profile);

// authenticated routes
export default router;
