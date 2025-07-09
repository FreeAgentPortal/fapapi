import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import TeamService from '../service/TeamService';

const router = express.Router();

const service = new TeamService();

router.route('/check').get(service.checkResource); // check if a resource exists in the database
router.route('/').get(service.getResources).post(AuthMiddleware.protect, service.create); // ideally this would never be used as profiles should be created during registration
router
  .route('/:id')
  .get(service.getResource) // get public profile by id
  .put(AuthMiddleware.protect, service.updateResource) // update profile by user id
  .delete(AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'developer']) as any, service.removeResource); // delete profile by user id
router.route('/profile/:id').get(AuthMiddleware.protect, service.getResource); // get profile by user id

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Auth service is up and running',
    success: true,
  });
});

// authenticated routes
export default router;
