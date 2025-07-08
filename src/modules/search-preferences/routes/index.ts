// modules/search-preferences/routes/index.ts
import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { SearchPreferencesService } from '../services/SearchPreference.service';
import schedulerRoutes from './schedulerRoutes';

const router = express.Router();

const service = new SearchPreferencesService();

// Scheduler routes (includes admin and user routes)
router.use('/scheduler', schedulerRoutes);

// Main search preferences CRUD routes
router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources).post(service.create);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

// Example diagnostic route
router.get('/health', (req, res) => {
  res.json({ status: 'search preferences module online' });
});

export default router;
