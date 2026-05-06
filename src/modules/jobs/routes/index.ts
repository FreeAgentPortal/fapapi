import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import authenticateUser from '../../../utils/authenticateUser';
import JobPostService from '../services/JobPostService';

const router = express.Router();

const service = new JobPostService();

router.route('/health').get((req, res) => {
  res.status(200).json({
    success: true,
    message: 'jobs service is up and running',
  });
});

router.route('/team/mine').get(AuthMiddleware.protect, service.getResources);

router.route('/').get(service.getResources).post(AuthMiddleware.protect, service.create);

router.route('/:id').get(service.getResource).patch(AuthMiddleware.protect, service.updateResource).delete(AuthMiddleware.protect, service.removeResource);

export default router;
