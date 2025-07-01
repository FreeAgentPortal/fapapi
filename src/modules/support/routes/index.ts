import express from 'express';
import ticketRoutes from './ticket';
import agentRoutes from './agent';
import adminSupportRoutes from './group';
import SupportService from '../services/SupportService';

const router = express.Router();

const supportService = new SupportService();

router.route('/').get(supportService.getResources);

router.use('/support_group', adminSupportRoutes);
router.use('/agent', agentRoutes);
router.use('/ticket', ticketRoutes);

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Support service is up and running',
    success: true,
  });
});

// authenticated routes
export default router;
