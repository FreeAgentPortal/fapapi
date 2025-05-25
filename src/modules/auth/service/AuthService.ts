import { Request, Response } from 'express';
import { RegisterHandler } from '../handlers/RegisterHandler';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticationHandler } from '../handlers/AuthenticationHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { PasswordRecoveryHandler } from '../handlers/PasswordRecoveryHandler';
import { token } from 'morgan';

export default class AuthService {
  private authHandler: AuthenticationHandler;
  private passwordRecoveryHandler: PasswordRecoveryHandler;

  constructor(
    authHandler: AuthenticationHandler,
    passwordRecoveryHandler: PasswordRecoveryHandler
  ) {
    this.authHandler = authHandler;
    this.passwordRecoveryHandler = passwordRecoveryHandler;
  }

  async register(req: Request, res: Response) {
    try {
      const handler = new RegisterHandler(req.body);
      const result = await handler.execute();

      eventBus.publish('user.registered', {
        user: result.user,
      });

      result.user = null;
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || 'Registration failed' });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await this.authHandler.login(req);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  async getMe(req: Request, res: Response) {
    try {
      const result = await this.authHandler.getMe(req as AuthenticatedRequest);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(401).json({ error: err.message });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const result = await this.passwordRecoveryHandler.requestReset(req.body.email);

      // Emit event for password reset request
      eventBus.publish('password.reset.requested', {
        email: result.email,
        token: result.token,
      });

      return res.status(200).json({ message: 'Recovery email sent' });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || 'Password recovery failed' });
    }
  }
}
