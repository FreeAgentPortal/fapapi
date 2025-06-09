import express from 'express';
import AuthService from '../service/AuthService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { AuthenticationHandler } from '../handlers/AuthenticationHandler';
import { PasswordRecoveryHandler } from '../handlers/PasswordRecoveryHandler';
import { RegisterHandler } from '../handlers/RegisterHandler';
import featureRoutes from './featureRoutes';

const router = express.Router();

const authService = new AuthService(new AuthenticationHandler(), new PasswordRecoveryHandler(), new RegisterHandler());

router.route('/:email/email').get(authService.checkEmail);
router.post('/register', authService.register);
router.route('/recaptcha').post(authService.recaptcha);
router.route('/resetpassword/:resettoken').put(authService.resetPassword);
router.route('/forgot-password').post(authService.forgotPassword);
router.route('/verifyEmail').post(authService.verifyEmail);
router.route('/resend-verification-email').post(authService.resendVerificationEmail);
router.route('/login').post(authService.login);
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

router.use('/feature', featureRoutes);
// authenticated routes
router.get('/me', AuthMiddleware.protect, authService.getMe);
export default router;
