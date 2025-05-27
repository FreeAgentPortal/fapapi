import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import asyncHandler from './asyncHandler';
import User from '../modules/auth/model/User';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';

export class AuthMiddleware {
  /**
   * Middleware to protect routes by verifying JWT token
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Next function to call the next middleware
   * @returns {void}
   */
  static protect = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401);
        throw new Error('No authorization header provided.');
      }

      if (authHeader.startsWith('Bearer ')) {
        await AuthMiddleware.verifyJwt(req, res, next);
      } else if (authHeader.startsWith('ApiKey ')) {
        await AuthMiddleware.verifyApiKey(req, res, next);
      } else {
        res.status(401);
        throw new Error('Unsupported authentication method.');
      }
    }
  );

  private static async verifyJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization!.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      req.user = await User.findById(decoded.userId).select('-password');
      if (!req.user) {
        res.status(401);
        throw new Error('User not found.');
      } 

      next();
    } catch (err) {
      res.status(401);
      throw new Error('JWT validation failed.');
    }
  }

  private static async verifyApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const apiKey = req.headers.authorization!.split(' ')[1];

    const validKey = process.env.INTERNAL_API_KEY; // or use a DB-stored key lookup if needed

    if (!validKey || apiKey !== validKey) {
      res.status(403);
      throw new Error('Invalid or missing API key.');
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
  static authorizeRoles(allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user || !allowedRoles.includes(req.user.role[0])) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };
  }
}
