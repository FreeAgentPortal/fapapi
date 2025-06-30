import express from 'express';
import authRoutes from '../../modules/auth/route/authRoutes';
import athleteRoutes from '../../modules/athlete/route/index';
import teamRoutes from '../../modules/team/route/index';
import supportRoutes from '../../modules/support/routes/index';
import paymentRoutes from '../../modules/payment/routes/index';
import feedRoutes from '../../modules/feed/routes/index';
import uploadRoutes from '../../modules/upload/routes/index';
import notificationRoutes from '../../modules/notification/route/index';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/athlete', athleteRoutes);
router.use('/team', teamRoutes);
router.use('/support', supportRoutes);
router.use('/payment', paymentRoutes);
router.use('/feed', feedRoutes);
router.use('/upload', uploadRoutes);
router.use('/notification', notificationRoutes);

export default router;
