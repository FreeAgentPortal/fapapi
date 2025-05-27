import express from 'express'; 
import authRoutes from '../../modules/auth/route/authRoutes';
import athleteRoutes from '../../modules/athlete/route/index';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/athlete', athleteRoutes); 

export default router;
