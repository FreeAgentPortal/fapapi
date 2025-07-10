// modules/search-preferences/routes/index.ts
import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { ReportService } from '../services/ReportService';

const router = express.Router();

const service = new ReportService();

// Main search preferences CRUD routes
router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources).post(service.create);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

export default router;
