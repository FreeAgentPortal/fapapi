import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import ReceiptService from '../services/ReceiptService';

const router = express.Router();

const receiptService = new ReceiptService();

router.route('/').get(AuthMiddleware.protect, receiptService.getResources);
router.route('/:id').get(AuthMiddleware.protect, receiptService.getResource);
router.route('/payment-statistics/:billingAccountId').get(AuthMiddleware.protect, receiptService.paymentStatistics); 

export default router;
