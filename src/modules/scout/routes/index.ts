// modules/scout/routes/index.ts
import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { ScoutReportHandler } from '../handlers/ScoutReport.handler';
import { PortfolioHandler } from '../handlers/Portfolio.handler';

const router = express.Router();

const reports = new ScoutReportHandler();
const portfolios = new PortfolioHandler();
// Example diagnostic route
router.get('/health', (req, res) => {
  res.json({ status: 'Scout module online' });
});

// Main search preferences CRUD routes
router.use(AuthMiddleware.protect);
router.route('/portfolio').get(portfolios.draft).patch(portfolios.edit);
router.post('/portfolio/items', portfolios.addItem);
router.route('/portfolio/items/:itemId').put(portfolios.replaceItem).delete(portfolios.removeItem);
router.post('/portfolio/submit', portfolios.submit);
router.post('/portfolio/withdraw', portfolios.withdraw);
router.get('/portfolio/submissions', portfolios.history);
router.get('/submissions/:submissionId', portfolios.submission);
router.get('/submissions/:submissionId/items/:itemId', portfolios.submittedItem);
router.get('/submissions/:submissionId/feedback', portfolios.feedback);
router.post('/submissions/:submissionId/reviews', portfolios.start);
router.get('/reviews', portfolios.mine);
router.route('/reviews/:reviewId').get(portfolios.review).patch(portfolios.saveReview);
router.route('/reviews/:reviewId/items/:itemId').get(portfolios.readItemFeedback).put(portfolios.itemFeedback);
router.post('/reviews/:reviewId/decline', portfolios.decline);
router.post('/reviews/:reviewId/report', portfolios.report);
router.route('/').get(reports.list).post(reports.create);
router.route('/:id').get(reports.get).put(reports.update).delete(reports.remove);
router.post('/:id/handle', reports.decide);

export default router;
