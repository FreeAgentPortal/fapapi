import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { InterestService } from '../services/InterestService';

const router = express.Router();
const service = new InterestService();

router.use(AuthMiddleware.protect);

router.get('/quota', service.getQuota);
router.get('/mine/status', service.getMineStatuses);
router.get('/mine', service.getMine);
router.get('/team', service.getTeamInbox);
router.get('/team/:interestId', service.getTeamInterest);
router.patch('/team/:interestId/view', service.markViewed);
router.patch('/team/:interestId/dismiss', service.dismiss);
router.post('/team/:interestId/conversation', service.startConversation);
router.post('/', service.expressInterest);

export default router;
