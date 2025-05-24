import { Request, Response } from 'express';
import { RegisterHandler } from '../handlers/RegisterHandler';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticationHandler } from '../handlers/AuthenticationHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';

export default class AuthService {
  static async register(req: Request, res: Response) {
    try {
      // RegisterHandler, Registers a new user and handles the registration logic
      const handler = new RegisterHandler(req.body);
      const result = await handler.execute();

      // fire off the event to send the email
      eventBus.publish('user.registered', {
        user: result.user,
      });

      result.user = null; // remove user from response to avoid sending sensitive data

      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Registration failed' });
    }
  }
  static async login(req: Request, res: Response) {
    try {
      const handler = new AuthenticationHandler();
      const result = await handler.login(req);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getMe(req: Request, res: Response) {
  try {
    const handler = new AuthenticationHandler();
    const result = await handler.getMe(req as AuthenticatedRequest);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}
}
