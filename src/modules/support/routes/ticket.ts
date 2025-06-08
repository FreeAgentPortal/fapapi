import express from 'express';
import TicketService from '../services/TicketService';

const router = express.Router();

const ticketService = new TicketService();

router.route('/').post(ticketService.create).get(ticketService.getResources);
router.route('/:id').get(ticketService.getResource).put(ticketService.updateResource).delete(ticketService.removeResource);
router.route('/:id/message').get(ticketService.getResource).post(ticketService.create);

// authenticated routes
export default router;
