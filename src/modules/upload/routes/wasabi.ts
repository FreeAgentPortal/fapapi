// modules/notification/routes/index.ts
import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { WasabiService } from '../services/WasabiService';

const router = express.Router();

const service = new WasabiService();

router.route('/file').post(AuthMiddleware.protect, service.uploadUserFile);
 
export default router;
