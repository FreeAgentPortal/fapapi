import { Request, Response } from 'express';
import { RegisterHandler } from '../handlers/registerHandler';
import { eventBus } from '../../../lib/eventBus';

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

      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Registration failed' });
    }
  }
}
