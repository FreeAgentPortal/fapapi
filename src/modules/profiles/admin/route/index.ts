import express, { NextFunction, Response } from 'express';
import AdminService from '../service/AdminService';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import { RolesConfig } from '../../../../utils/RolesConfig';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';

export const authorizeProfileViewAnalytics = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const hasPermission = req.user?.permissions?.includes('analytics.profileViews');
  const isExistingAdmin = req.user?.roles?.includes('admin');
  if (!hasPermission && !isExistingAdmin) {
    return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
  }
  return next();
};

const router = express.Router();

const service = new AdminService();
router.route('/health').get((req, res) => {
  res.status(200).json({
    message: 'Support service is up and running',
    success: true,
  });
});

router.use(AuthMiddleware.protect);
router.use(AuthMiddleware.authorizeRoles(RolesConfig.getDefaultPermissionsForRole('admin')) as any);
router.route('/reports/agent-management').get(service.getAgentManagementReport);
router.route('/reports/profile-views').get(authorizeProfileViewAnalytics as any, service.getProfileViewReport);
router.route('/profile/:id').get(service.getResource);

router.route('/').post(service.create).get(service.getResources);
router.route('/:id').get(service.getResource).put(service.updateResource).delete(service.removeResource);

// authenticated routes
export default router;
