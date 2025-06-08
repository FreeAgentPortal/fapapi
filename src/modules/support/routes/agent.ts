import express from 'express';
import TicketService from '../services/TicketService';
import AgentService from '../services/AgentService';

const router = express.Router();

const agentService = new AgentService();
router.route('/:id').get(agentService.getResource);

// authenticated routes
export default router;
