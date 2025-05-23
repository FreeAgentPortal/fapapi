import express from 'express';
import login from '../controller/login';
import register from '../controller/register';

const router = express.Router();

// router.route('/:username/username').get(checkUsername);
// router.route('/:email/email').get(checkEmailExists);
router.route('/register').post(register);
// router.route('/recaptcha').post(recaptcha);
// router.route('/resetpassword/:resettoken').put(resetPassword);
// router.route('/forgotpassword').post(forgotpassword);
// router.route('/verifyEmail').post(verifyEmail);
// router.route('/resend-verification-email').post(resendVerificationEmailVerify);
router.route('/login').post(login);
// router.route('/me').post(getMe);
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

export default router;
