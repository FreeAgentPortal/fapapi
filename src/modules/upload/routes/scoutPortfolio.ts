import express from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { PortfolioUploadHandler } from '../handlers/PortfolioUpload.handler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';

const router = express.Router();
const handler = new PortfolioUploadHandler();
const limiter = rateLimit({ windowMs: 60_000, limit: 30, keyGenerator: req => String((req as AuthenticatedRequest).user._id), standardHeaders: true, legacyHeaders: false });
router.use(AuthMiddleware.protect);
router.get('/assets', handler.list);
router.post('/assets', limiter, handler.reserve);
// Binary bodies avoid the global multipart middleware's unbounded buffering.
router.put('/assets/:assetId/content', limiter, express.raw({ type: 'application/octet-stream', limit: '25mb', inflate: false }), handler.upload);
router.get('/assets/:assetId/download', handler.download);
router.delete('/assets/:assetId', handler.remove);
export default router;
