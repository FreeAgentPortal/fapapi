import { ErrorUtil } from "../../../middleware/ErrorUtil";
import { EmailService } from "../email/EmailService";

export default class RegistrationEventHandler {
  public emailVerification = async (event: any): Promise<void> => {
    try {
      const { user } = event;
      // TODO: replace with real implementations
      console.log(`[Notification] Email Verification for email: ${user.email}`);

      await EmailService.sendEmail({
        to: user.email,
        subject: 'Welcome to FreeAgent Portal - Please Verify Your Email',
        templateId: 'd-ef91fa3ddf554f33b6efdd205c181f7b', // replace with your actual template ID
        data: {
          firstName: user.firstName,
          currentYear: new Date().getFullYear(),
          token: user.emailVerificationToken,
          subject: 'Welcome to FreeAgent Portal - Please Verify Your Email',
        },
      });
    } catch (err: any) {
      console.log(err.response.body.errors);
      throw new ErrorUtil('Failed to handle user verify email event', 500);
    }
  };

  async emailVerified(event: any): Promise<void> {
    const { user } = event;
    if (!user) {
      throw new Error('User data is required for email verification event handling');
    }

    // Logic to handle email verification, e.g., logging or sending a confirmation email
    console.log(`[Notification] Email verified for user: ${user.email}`);
    try {
      await EmailService.sendEmail({
        to: user.email,
        subject: 'Your Email Has Been Verified',
        templateId: 'd-249bb1a6027346ccbd25344eadbe14d4', // replace with your actual template ID
        data: {
          firstName: user.firstName,
          currentYear: new Date().getFullYear(),
          subject: 'Your Email Has Been Verified',
        },
      }); 
    } catch (err: any) {
      console.error('Failed to send email verification confirmation:', err);
      throw new ErrorUtil('Failed to send email verification confirmation', 500);
    }
  }
}
