import express from 'express';
import TicketService from '../services/TicketService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';

const router = express.Router();

const ticketService = new TicketService();

router.use(AuthMiddleware.protect);
router.route('/').post(ticketService.create).get(ticketService.getResources);
router.route('/:id').get(ticketService.getResource).put(ticketService.updateResource).delete(ticketService.removeResource);
router.route('/:id/message').get(ticketService.getMessages).post(ticketService.createMessage);

// authenticated routes
export default router;
