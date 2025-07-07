// modules/notification/routes/index.ts
import express from 'express'; 
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { SearchPreferencesService } from '../services/SearchPreference.service';

const router = express.Router();

const service = new SearchPreferencesService();


router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources).post(service.create);

router.use(AuthMiddleware.authorizeRoles(['admin', 'developer']) as any);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);

// Example diagnostic route
router.get('/health', (req, res) => {
  res.json({ status: 'notification module online' });
});

export default router;
