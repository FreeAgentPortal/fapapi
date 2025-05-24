// modules/notification/routes/index.ts
import express from 'express';

const router = express.Router();

// Example diagnostic route
router.get('/health', (req, res) => {
  res.json({ status: 'notification module online' });
});

export default router;
