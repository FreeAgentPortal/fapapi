import express, { NextFunction, Request, Response } from 'express';
import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';
import { ProfileViewService } from '../service/ProfileViewService';
import { ProfileSubjectType } from '../types';

export const createProfileViewRouter = (subjectType: ProfileSubjectType) => {
  const router = express.Router();
  const service = new ProfileViewService(subjectType);
  const supportedServices = new Set(['team', 'athlete', 'professional', 'agent', 'admin', 'scout_profile']);

  const validateViewerContextHeader = (req: Request, res: Response, next: NextFunction) => {
    const serviceName = req.headers['x-service-name'];
    if (typeof serviceName !== 'string' || !supportedServices.has(serviceName)) {
      return res.status(400).json({ success: false, message: 'X-Service-Name must identify a supported viewer profile' });
    }
    return next();
  };

  router.route('/:id').post(validateViewerContextHeader, AuthMiddleware.protect, service.trackView).get(AuthMiddleware.protect, service.getReport);

  return router;
};
