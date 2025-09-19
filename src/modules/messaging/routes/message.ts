import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { MessageService } from '../services/Message.service';

const router = express.Router();

const service = new MessageService();

router.use(AuthMiddleware.authorizeRoles(['*', 'admin', 'developer']) as any);

router.route('/:id').put(service.updateResource);

export default router;
