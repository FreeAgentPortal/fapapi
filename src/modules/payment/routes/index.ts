import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import PaymentService from '../services/PaymentService';
import receiptRoutes from './receipts';
import transactionRoutes from './transactions'

const router = express.Router();

const paymentService = new PaymentService();

router.use('/receipt', receiptRoutes);
router.use('/transactions', transactionRoutes);
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Payment service is up and running',
    success: true,
  });
});

router.route('/:id').get(AuthMiddleware.protect, paymentService.fetchBilling).post(AuthMiddleware.protect, paymentService.updateBilling);

export default router;
