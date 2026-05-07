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

router.route('/').get(service.getResources).post(service.create);
router.route('/:id').get(service.getResource).patch(service.updateResource).delete(service.removeResource);
router.route('/:jobId/applications').get(service.getApplicationsForJob).post(service.applyToJob);
router.route("/mine").get(service.getMyApplications);
router.route("/:id/status").patch(service.updateApplicationStatus);
router.route("/:id/withdraw").post(service.withdrawApplication);

export default router;
