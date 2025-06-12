import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import PaymentService from '../services/PaymentService';

const router = express.Router();

const paymentService = new PaymentService();

router.route('/').get((req, res) => {
  res.status(200).json({ message: 'hello' });
});
router.route('/:id').post(AuthMiddleware.protect, paymentService.updateBilling);

router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Payment service is up and running',
    success: true,
  });
});

export default router;
