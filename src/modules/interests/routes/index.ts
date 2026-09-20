import express, { NextFunction, Response } from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { InterestService } from '../services/InterestService';

const router = express.Router();
const service = new InterestService();

router.use(AuthMiddleware.protect);

const authorizeInterestReport = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (
    req.headers.authorization?.startsWith('Bearer ') &&
    req.headers['x-service-name'] === 'admin' &&
    req.user?.roles?.includes('admin')
  ) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
};

router.get('/report', authorizeInterestReport as any, service.getReport);
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
