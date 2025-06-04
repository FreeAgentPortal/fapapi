import { Request, Response } from 'express';
import { RegisterHandler } from '../handlers/RegisterHandler';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticationHandler } from '../handlers/AuthenticationHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { PasswordRecoveryHandler } from '../handlers/PasswordRecoveryHandler';
import error from '../../../middleware/error';

export default class AuthService {
  constructor(
    private readonly authHandler: AuthenticationHandler,
    private readonly passwordRecoveryHandler: PasswordRecoveryHandler,
    private readonly registerHandler: RegisterHandler
  ) {}

  public register = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.registerHandler.execute(req.body);

      eventBus.publish('user.registered', {
        user: result.user,
      });

      result.user = null;
      return res.status(201).json(result);
    } catch (err: any) { 
      return error(err, req, res);
    }
  }; 

  public login = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.authHandler.login(req);
      return res.status(200).json(result);
    } catch (err: any) {
      return error(err, req, res); 
    }
  };

  async getMe(req: Request, res: Response) {
    try {
      const result = await this.authHandler.getMe(req as AuthenticatedRequest);
      return res.status(200).json(result);
    } catch (err: any) {
      return error(err, req, res); 
    }
  }

  public forgotPassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.passwordRecoveryHandler.requestReset(req.body.email);

      // Emit event for password reset request
      eventBus.publish('password.reset.requested', {
        email: result.email,
        token: result.token,
      });

      return res.status(200).json({ message: 'Recovery email sent' });
    } catch (err: any) {
      return error(err, req, res); 
    }
  };

  public resetPassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { token, newPassword } = req.body;
      await this.passwordRecoveryHandler.resetPassword(token, newPassword);
      return res.status(200).json({ message: 'Password reset successful' });
    } catch (err: any) {
      return error(err, req, res); 
    }
  };

  public verifyEmail = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.registerHandler.verifyEmail(req.body.email);

      // Emit event for email verification
      eventBus.publish('email.verified', {
        email: req.body.email,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      return error(err, req, res); 
    }
  };

  public resendVerificationEmail = async (req: Request, res: Response): Promise<Response> => {
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

      return res
        .status(200)
        .json({ success: true, message: 'Verification email sent', token: result.token });
    } catch (err: any) {
      return error(err, req, res); 
    }
  };

  public recaptcha = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.authHandler.recaptchaVerify(req);
      return res.status(200).json(result);
    } catch (err: any) {
      return error(err, req, res);
    }
  };

  public checkEmail = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // const exists = await this.authHandler.checkEmailExists(email);
      return res.status(200).json({
        // exists
      });
    } catch (err: any) {
      return error(err, req, res); 
    }
  };
}
