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
  private registerHandler: RegisterHandler;

  constructor(
    authHandler: AuthenticationHandler,
    passwordRecoveryHandler: PasswordRecoveryHandler,
    registerHandler: RegisterHandler
  ) {
    this.authHandler = authHandler;
    this.passwordRecoveryHandler = passwordRecoveryHandler;
    this.registerHandler = registerHandler;
  }

  async register(req: Request, res: Response) {
    try { 
      const result = await this.registerHandler.execute(req.body);

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

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      await this.passwordRecoveryHandler.resetPassword(token, newPassword);
      return res.status(200).json({ message: 'Password reset successful' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try { 
      const result = await this.registerHandler.verifyEmail(req.body.email);

      // Emit event for email verification
      eventBus.publish('email.verified', {
        email: req.body.email,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  async resendVerificationEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const result = await this.registerHandler.setEmailVerificationToken(email);

      // Emit event for resending verification email
      eventBus.publish('email.verify', {
        email,
        token: result.token,
      });

      return res.status(200).json({success: true, message: 'Verification email sent', token: result.token});
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  async recaptcha(req: Request, res: Response) {
    try {
      const result = await this.authHandler.recaptchaVerify(req);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  async checkEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // const exists = await this.authHandler.checkEmailExists(email);
      // return res.status(200).json({ exists });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

}
