import express from 'express';
import { AgentDashboardService } from '../service/AgentDashboard.service';

const router = express.Router();
const service = new AgentDashboardService();

router.route('/seats').get(service.getSeatsCard);
router.route('/invites').get(service.getInvitesCard);
router.route('/views').get(service.getViewsCard);
router.route('/inbox').get(service.getInboxCard);

export default router;
