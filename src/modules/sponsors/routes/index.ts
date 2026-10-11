import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { SponsorService } from '../services/SponsorService';
import { SponsorFeedHandler } from '../handlers/SponsorFeedHandler';

const router = express.Router();
const service = new SponsorService();
const feed = new SponsorFeedHandler();

router.get('/public', service.getVisible);

router.use(AuthMiddleware.protect);
router.post('/feed-events', feed.recordEvent);
router.use(AuthMiddleware.authorizeRoles(['admin']) as any);
router.get('/report', feed.report);
router.route('/:id/feed-ad').get(feed.getAd).put(feed.saveAd).delete(feed.removeAd);
router.route('/').get(service.getResources).post(service.create);
router.route('/:id').get(service.getResource).put(service.updateResource).patch(service.updateResource).delete(service.removeResource);

export default router;
