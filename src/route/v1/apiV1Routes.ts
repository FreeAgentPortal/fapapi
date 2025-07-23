import express from 'express';
import authRoutes from '../../modules/auth/route/authRoutes';
import athleteRoutes from '../../modules/profiles/athlete/route/index';
import teamRoutes from '../../modules/profiles/team/route/index';
import supportRoutes from '../../modules/support/routes/index';
import paymentRoutes from '../../modules/payment/routes/index';
import feedRoutes from '../../modules/feed/routes/index';
import uploadRoutes from '../../modules/upload/routes/index';
import notificationRoutes from '../../modules/notification/route/index';
import adminRoutes from '../../modules/profiles/admin/route/index';
import searchPreferencesRoutes from '../../modules/search-preferences/routes/index';
import userRoutes from '../../modules/user/route/index';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/athlete', athleteRoutes);
router.use('/team', teamRoutes);
router.use('/support', supportRoutes);
router.use('/payment', paymentRoutes);
router.use('/feed', feedRoutes);
router.use('/upload', uploadRoutes);
router.use('/notification', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/search-preference', searchPreferencesRoutes);
router.use('/user', userRoutes);

export default router;
