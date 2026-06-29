import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import { AthleteAssignmentService } from '../service/AthleteAssignment.service';

const router = express.Router();

const service = new AthleteAssignmentService();

router.use(AuthMiddleware.protect);
router.route('/').get(service.getResources);

// authenticated routes
export default router;
