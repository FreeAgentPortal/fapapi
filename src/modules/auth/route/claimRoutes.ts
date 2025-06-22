import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import ClaimService from '../service/ClaimService';

const router = express.Router();

const service = new ClaimService();

router.route('/:profile').get(service.getClaim);
router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(['admin', 'developer']) as any);

export default router;
