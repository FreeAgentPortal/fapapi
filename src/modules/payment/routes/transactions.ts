import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware'; 
import TransactionService from '../services/TransactionService';

const router = express.Router();

const service = new TransactionService();

router.route('/:id/process-transaction').post(AuthMiddleware.protect, service.processTransaction);
router.route('/:id/refund-transaction').post(AuthMiddleware.protect, service.refundTransaction);
router.route('/:id/void-transaction').post(AuthMiddleware.protect, service.voidTransaction);
router.route('/trigger-scheduled-payments').post(
  AuthMiddleware.protect,
  AuthMiddleware.authorizeRoles(['admin', 'internal']) as any,
  service.triggerScheduledPayments
); 

export default router;
