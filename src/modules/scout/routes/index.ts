// modules/scout/routes/index.ts
import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { ScoutService } from '../services/Scout.service';

const router = express.Router();

const service = new ScoutService();
// Example diagnostic route
router.get('/health', (req, res) => {
  res.json({ status: 'Scout module online' });
});

// Main search preferences CRUD routes
router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources).post(service.create);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);
router.route("/:id/handle").post(service.reportSubmission);

export default router;
