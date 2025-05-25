import express from 'express';
import AuthService from '../service/AuthService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { AuthenticationHandler } from '../handlers/AuthenticationHandler';
import { PasswordRecoveryHandler } from '../handlers/PasswordRecoveryHandler';


const router = express.Router();

const authService = new AuthService(
  new AuthenticationHandler(),
  new PasswordRecoveryHandler()
);

// router.route('/:username/username').get(checkUsername);
// router.route('/:email/email').get(checkEmailExists);
router.post('/register', authService.register);
// router.route('/recaptcha').post(recaptcha);
router.route('/resetpassword/:resettoken').put(authService.resetPassword);
router.route('/forgotpassword').post(authService.forgotPassword);
// router.route('/verifyEmail').post(verifyEmail);
// router.route('/resend-verification-email').post(resendVerificationEmailVerify);
router.route('/login').post(authService.login);
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

// authenticated routes
router.get('/me', AuthMiddleware.protect, authService.getMe); 
export default router;
