// modules/notification/routes/index.ts
import express from 'express';
import { UploadService } from '../services/UploadService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';

const router = express.Router();

const service = new UploadService();

router.route('/file').post(AuthMiddleware.protect, service.uploadUserFile); 

// Example diagnostic route
router.get('/health', (req, res) => {
  res.json({ status: 'Upload module online' });
});

export default router;
