import express from 'express';
import AthleteService from '../service/AthleteService';
import { AthleteProfileHandler } from '../handlers/AtheleteProfileHandler';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';

const router = express.Router();

const service = new AthleteService();

router.route('/profile').post(AuthMiddleware.protect, service.createProfile); // ideally this would never be used as profiles should be created during registration
// router.route('/profile').get(AuthMiddleware.protect, service.getProfile); // get the authenticated user's profile

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

// authenticated routes
export default router;
