import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import EventRegistrationService from '../services/EventRegistration.service';
import SigningService from '../services/Signing.service';

const router = express.Router({ mergeParams: true }); // mergeParams to access :eventId from parent

const service = new SigningService();
router.route('/').get(service.getResources);

router.use(AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'scout']) as any);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource).get(service.getResource);

export default router;
