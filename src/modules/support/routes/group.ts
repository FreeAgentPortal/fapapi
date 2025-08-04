import express from 'express';
import SupportGroupService from '../services/SupportGroup.service';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';

const router = express.Router();

const service = new SupportGroupService();
router.route('/').get(service.getResources); // Get all support groups

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['admin', 'support', 'developer']) as any);

router.route('/').post(service.create); // Create a new support group
router
  .route('/:id')
  .get(service.getResource) // Get a specific support group by ID
  .put(service.updateResource) // Update a specific support group by ID
  .delete(service.removeResource); // Delete a specific support group by ID

// authenticated routes
export default router;
