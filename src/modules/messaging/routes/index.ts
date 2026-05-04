import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { ConversationService } from '../services/Conversation.service';
import adminRoutes from './admin';
import messageRoutes from './message';
import unreadAlertsRoutes from './unreadAlerts';

const router = express.Router();
const service = new ConversationService();

router.use(AuthMiddleware.protect);
router.use('/admin/message', messageRoutes);
router.use('/admin', adminRoutes);
router.use('/unread-alerts', unreadAlertsRoutes);

router.route('/').get(service.getConversations).post(service.startConversation);

router.route('/:conversationId/messages').post(service.sendMessage).get(service.getConversation);

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Messaging service is up and running',
    success: true,
  });
});

export default router;
