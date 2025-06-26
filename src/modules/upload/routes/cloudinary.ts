// modules/notification/routes/index.ts
import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { CloudinaryService } from '../services/CloudinaryService';

const router = express.Router();

const service = new CloudinaryService();

router.route('/file').post(AuthMiddleware.protect, service.uploadUserFile);

export default router;
