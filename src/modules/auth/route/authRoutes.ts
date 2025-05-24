import express from 'express';
import login from '../controller/login';
import AuthService from '../service/AuthService';
import { protect } from '../../../middleware/auth';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
const router = express.Router();

// router.route('/:username/username').get(checkUsername);
// router.route('/:email/email').get(checkEmailExists);
router.post('/register', AuthService.register);
// router.route('/recaptcha').post(recaptcha);
// router.route('/resetpassword/:resettoken').put(resetPassword);
// router.route('/forgotpassword').post(forgotpassword);
// router.route('/verifyEmail').post(verifyEmail);
// router.route('/resend-verification-email').post(resendVerificationEmailVerify);
router.route('/login').post(AuthService.login);
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

// authenticated routes
router.get('/me', AuthMiddleware.protect, AuthService.getMe); 
export default router;
