import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { ConversationService } from '../services/Conversation.service';

const router = express.Router();

const service = new ConversationService();

router.use(AuthMiddleware.authorizeRoles(['*', 'admin', 'developer']) as any);
router.route('/').get(service.getResources);
router.route('/:id').get(service.getResource).put(service.updateResource);

export default router;
