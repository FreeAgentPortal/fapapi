import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware';
import ReceiptService from '../services/ReceiptService';

const router = express.Router();

const receiptService = new ReceiptService();

router.route('/:id').get(AuthMiddleware.protect, receiptService.fetchReceipts);

export default router;
