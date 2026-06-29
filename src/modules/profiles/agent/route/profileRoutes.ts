import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';  
import { AgentService } from '../service/AgentService';

const router = express.Router();

const service = new AgentService();

router.use(AuthMiddleware.protect);
router.route('/:id').get(service.profile);

// authenticated routes
export default router;
