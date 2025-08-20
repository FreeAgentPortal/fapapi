import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import asyncHandler from './asyncHandler';
import User from '../modules/auth/model/User';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';
import { ErrorUtil } from './ErrorUtil';
import { ModelMap } from '../utils/ModelMap';

export class AuthMiddleware {
  /**
   * Middleware to protect routes by verifying JWT token
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Next function to call the next middleware
   * @returns {void}
   */
  static protect = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new ErrorUtil('No authorization header provided.', 401);
    }

    if (authHeader.startsWith('Bearer ')) {
      await AuthMiddleware.verifyJwt(req, res, next);
    } else if (authHeader.startsWith('ApiKey ')) {
      await AuthMiddleware.verifyApiKey(req, res, next);
    } else {
      return res.status(401).json({ message: 'Unsupported authentication method.' });
    }
  });

  private static async verifyJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const service = req.headers['x-service-name'];
      const token = req.headers.authorization!.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      req.user = await User.findById(decoded.userId).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'User not found.' });
      }
      // if the service is provided we need to then attempt to find the users permissions for that service, i.e. 'admin'
      // query the admin table for the profile associated with the user
      if (service) {
        const serviceName = Array.isArray(service) ? service[0] : service;
        const Model = ModelMap[serviceName as keyof typeof ModelMap] || {};
        const profile = await Model.findOne({ user: req.user._id });
        if (!profile) {
          return res.status(403).json({ message: `No profile found for service ${service}` });
        }
        req.user.permissions = profile.permissions || [];
        // push the users roles onto the permissions array for large role based access control
        req.user.roles = profile.roles || [];
        // push the roles onto the permissions array for large role based access control
        req.user.permissions.push(...(req.user.roles || []));
      } else {
        req.user.permissions = req.user.permissions || [];
      }

      next();
    } catch (err) {
      console.log(err);
      return res.status(401).json({ message: 'JWT validation failed. ' + err });
    }
  }

  private static async verifyApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const apiKey = req.headers.authorization!.split(' ')[1];

    const validKey = process.env.INTERNAL_API_KEY; // or use a DB-stored key lookup if needed

    if (!validKey || apiKey !== validKey) {
      return res.status(401).json({ message: 'Invalid or missing API key.' });
    }

    // Optionally attach a `system` user identity for internal operations
    req.user = {
      userId: 'system-api',
      roles: ['internal'],
      profileRefs: {},
    } as any;

    next();
  }
  /**
   * Middleware to authorize roles
   * @param allowedRoles - Array of roles that are allowed to access the route
   * @returns Middleware function
   */
  static authorizeRoles(requiredPermissions: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userPermissions = req.user?.permissions || [];

      const hasPermission = requiredPermissions.some((permission) => userPermissions.includes(permission));
      
      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
      }

      return next();
    };
  }
}
