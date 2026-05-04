// modules/notification/routes/index.ts
import express from 'express';
import { NCRUDService } from '../services/NCRUDService';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import { SMSHandler } from '../handler/SMSHandler';

const router = express.Router();

router.post('/format-phone', SMSHandler.formatPhoneNumber);

router.use(AuthMiddleware.protect, AuthMiddleware.authorizeRoles(['admin', 'developer']) as any);
router.post('/test', SMSHandler.testSMS);
router.post('/send', SMSHandler.sendSMS);


export default router;
