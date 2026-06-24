import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import { AgentService } from '../service/AgentService';
import { AgentRosterService } from '../service/AgentRoster.service';
import dashboardRoutes from './dashboard';

const router = express.Router();
const service = new AgentService();
const rosterService = new AgentRosterService();

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Agent profile service is up and running',
    success: true,
  });
});

router.route('/').get(service.getResources);

router.use(AuthMiddleware.protect);

router.use('/dashboard', dashboardRoutes);
router.use('/profile', require('./profileRoutes').default);
router.use('/assignment', require('./assignment').default);
router.route('/roster').get(rosterService.getRoster);
router.route('/roster/seats').get(rosterService.getSeatSummary);
router.route('/roster/invitations').post(rosterService.inviteAthlete);
router.route('/roster/invitations/:assignmentId').delete(rosterService.removeAthlete);
router.route('/roster/invitations/me').get(rosterService.getMyInvitations);
router.route('/roster/invitations/:invitationId/respond').post(rosterService.respondToInvitation);
router.route('/roster/representation/me').delete(rosterService.removeMyAgent);
router.route('/').post(service.create);
router.route('/:id').put(service.updateResource).delete(service.removeResource);
router.route('/:id').get(service.getResource);

export default router;
