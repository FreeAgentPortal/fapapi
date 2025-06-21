// modules/notification/email/SendGridProvider.ts
import sgMail from '@sendgrid/mail';
import { EmailPayload, EmailProvider } from './EmailProvider';

sgMail.setApiKey(process.env.SEND_GRID_API_KEY || '');

export class SendGridProvider implements EmailProvider {
  async sendEmail({ to, subject, html, from }: EmailPayload): Promise<void> {
    await sgMail.send({
      to,
      from: from || 'noreply@freeagentportal.com',
      subject,
      html,
    });
  }
}
