import express from 'express';
import { AuthMiddleware } from '../../../middleware/AuthMiddleware'; 
import TransactionService from '../services/TransactionService';

const router = express.Router();

const service = new TransactionService();

router.route('/:id/process-transaction').post(AuthMiddleware.protect, service.processTransaction);

export default router;
