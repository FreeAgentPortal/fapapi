import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import ApplicationService from '../services/Application.service';

const router = express.Router();

const service = new ApplicationService() as any;

router.route('/health').get((req, res) => {
  res.status(200).json({
    success: true,
    message: 'jobs service is up and running',
  });
});

router.use(AuthMiddleware.protect);
router.route('/mine/status-counts').get(service.getMyApplicationStatusCounts);
router.route('/mine').get(service.getMyApplications);

router.route('/').get(service.getResources);
router
  .route('/:id')
  .get(AuthMiddleware.authorizeRoles(['admin']) as any, service.getResource)
  .patch(AuthMiddleware.authorizeRoles(['admin']) as any, service.updateResource)
  .delete(AuthMiddleware.authorizeRoles(['admin']) as any, service.removeResource);
router.route('/:jobId').get(service.getApplicationsForJob).post(service.applyToJob);
router.route('/:id/status').patch(service.updateApplicationStatus);
router.route('/:id/withdraw').post(service.withdrawApplication);

export default router;
