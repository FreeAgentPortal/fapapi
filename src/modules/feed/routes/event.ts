import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { EventService } from '../services/Event.service';
import eventRegistrationRoutes from './eventRegistration';

const router = express.Router();

const service = new EventService();

// Mount registration routes under /:eventId/registration
router.use('/:eventId/registration', eventRegistrationRoutes);

// Public routes
router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource);

// Authenticated routes
router.use(AuthMiddleware.protect);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);
router.route('/:teamId/stats').get(service.getEventsStatsByTeam);

export default router;
