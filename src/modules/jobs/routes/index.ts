import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import authenticateUser from '../../../utils/authenticateUser';
import JobPostService from '../services/JobPostService';
import applicationsRoutes from './applications';

const router = express.Router();

const service = new JobPostService();

router.use('/applications', applicationsRoutes);

router.use(AuthMiddleware.protect);
router.route('/team/mine/stats').get(service.getTeamStats);
router.route('/team/mine').get(service.getResources);
router.route('/recommended').get(service.getRecommended);
router.route('/').get(service.getResources).post(service.create);
router.route('/:id').get(service.getResource).patch(service.updateResource).delete(service.removeResource);

export default router;
