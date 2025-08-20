// profiles/index.ts - Central routing
import express from 'express';
import adminRoutes from '../admin/route/index';
import athleteRoutes from '../athlete/route/index';
import teamRoutes from '../team/route/index';
import scoutRoutes from '../scout/routes/index';
import resumeRoutes from '../resume/routes/index';

const router = express.Router();

router.use('/admin', adminRoutes);
router.use('/athlete', athleteRoutes);
router.use('/team', teamRoutes);
router.use('/scout', scoutRoutes);
router.use('/resume', resumeRoutes);

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'profiles module online' });
});

export default router;
