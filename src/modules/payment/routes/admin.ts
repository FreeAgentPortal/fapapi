import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import SubscriptionRevenueReportService from '../services/SubscriptionRevenueReportService';

const router = express.Router();
const service = new SubscriptionRevenueReportService();

router.use(AuthMiddleware.protect);
router.use((req, res, next) => {
  const serviceHeader = req.headers['x-service-name'];
  const serviceName = Array.isArray(serviceHeader) ? serviceHeader[0] : serviceHeader;

  if (serviceName !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin service context required' });
  }

  return next();
});
router.use(AuthMiddleware.authorizeRoles(['finances.subscriptions']) as any);

router.route('/subscription-revenue').get(service.getReport);
router.route('/subscription-revenue/yearly').get(service.getYearlyReport);
router.route('/subscription-revenue/yearly/scenario').post(service.getYearlyScenario);
router.route('/unmatched-stripe-charges').get(service.getUnmatchedCharges);
router.route('/stripe-reconciliation/receipts').post(service.recoverStripeReceipt);

export default router;
