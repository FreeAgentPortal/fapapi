import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import EventRegistrationService from '../services/EventRegistration.service';

const router = express.Router({ mergeParams: true }); // mergeParams to access :eventId from parent

const service = new EventRegistrationService();

// All routes require authentication
router.use(AuthMiddleware.protect);

// User registration routes
router.route('/').get(service.getResources).post(service.registerForEvent).delete(service.cancelRegistration);
router.route('/me').get(service.getMyRegistration); // Get my registration

// Event organizer routes
router.route('/all').get(service.getEventRegistrations); // Get all registrations for event
router.route('/count').get(service.getRegistrationCount); // Get registration count
router.route('/:registrantId/status').put(service.updateRegistrationStatus); // Update registration status

export default router;
