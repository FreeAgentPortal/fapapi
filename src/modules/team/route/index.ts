import express from 'express'; 
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import TeamService from '../service/TeamService';

const router = express.Router();

const service = new TeamService();

router.route('/').get(service.getProfiles).post(AuthMiddleware.protect, service.createProfile); // ideally this would never be used as profiles should be created during registration
router
  .route('/:id')
  .get(service.getProfile) // get public profile by id
  .put(AuthMiddleware.protect, service.updateProfile) // update profile by user id
  .delete(
    AuthMiddleware.protect,
    AuthMiddleware.authorizeRoles(['admin', 'developer']) as any,
    service.deleteProfile
  ); // delete profile by user id

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

// authenticated routes
export default router;
