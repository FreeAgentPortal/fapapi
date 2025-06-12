import express from 'express';
import authRoutes from '../../modules/auth/route/authRoutes';
import athleteRoutes from '../../modules/athlete/route/index';
import teamRoutes from '../../modules/team/route/index';
import supportRoutes from '../../modules/support/routes/index';
import paymentRoutes from '../../modules/payment/routes/index';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/athlete', athleteRoutes);
router.use('/team', teamRoutes);
router.use('/support', supportRoutes);
router.use('/payment', paymentRoutes);

export default router;
