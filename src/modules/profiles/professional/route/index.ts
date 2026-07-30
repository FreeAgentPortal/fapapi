import express from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import { RolesConfig } from '../../../../utils/RolesConfig';
import ProfessionalService from '../service/Professional.service';
import TalentSearchHandler from '../handlers/TalentSearch.handler';
import talentSearchRateLimiter from './talentSearchRateLimiter';

const router = express.Router();

const service = new ProfessionalService();
const talentSearchHandler = new TalentSearchHandler();
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Support service is up and running',
    success: true,
  });
});

router.use(AuthMiddleware.protect);
router.use('/profile', require('./profileRoutes').default);

router
  .route('/search')
  .get(talentSearchHandler.authorizeTeam, talentSearchRateLimiter, talentSearchHandler.search);
router.route('/').post(service.create).get(AuthMiddleware.authorizeRoles(['api.read']) as any, service.getResources);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

router.use(AuthMiddleware.authorizeRoles(RolesConfig.getDefaultPermissionsForRole('admin')) as any);
// authenticated routes
export default router;
