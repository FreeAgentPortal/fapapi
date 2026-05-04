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
import profileRoutes from '../../modules/profiles/routes/index';
import scoutRoutes from '../../modules/scout/routes/index';
import messagingRoutes from '../../modules/messaging/routes/index';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/support', supportRoutes);
router.use('/payment', paymentRoutes);
router.use('/feed', feedRoutes);
router.use('/upload', uploadRoutes);
router.use('/notification', notificationRoutes);
router.use('/profiles', profileRoutes);
router.use('/search-preference', searchPreferencesRoutes);
router.use('/user', userRoutes);
router.use('/scout', scoutRoutes);
router.use('/messaging', messagingRoutes);

// TODO: Remove these when the new profile routes are fully integrated
router.use('/admin', adminRoutes);
router.use('/team', teamRoutes);
router.use('/athlete', athleteRoutes);

router.route('/').get((req, res) => {
  res.status(200).json({
    message: 'API V1 is working',
  });
});

export default router;
