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

router.route('/:id/payment-method').get(AuthMiddleware.protect, paymentService.fetchPaymentMethod).post(AuthMiddleware.protect, paymentService.createPaymentMethod).delete(AuthMiddleware.protect, paymentService.removePaymentMethod);
router.route('/:id/plan').patch(AuthMiddleware.protect, paymentService.changePlan);
router.route('/:id').get(AuthMiddleware.protect, paymentService.fetchBilling).post(AuthMiddleware.protect, paymentService.updateBilling).delete(AuthMiddleware.protect, paymentService.cancelAccount);

export default router;
