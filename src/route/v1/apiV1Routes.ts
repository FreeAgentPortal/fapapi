import express from 'express'; 
import authRoutes from '../../modules/auth/route/authRoutes';
import athleteRoutes from '../../modules/athlete/route/index';
import teamRoutes from '../../modules/team/route/index';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/athlete', athleteRoutes); 
router.use('/team', teamRoutes); 

export default router;
