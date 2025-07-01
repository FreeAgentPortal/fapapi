// modules/notification/email/SendGridProvider.ts
import sgMail from '@sendgrid/mail';
import { EmailPayload, EmailProvider } from './EmailProvider';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

sgMail.setApiKey(process.env.SEND_GRID_API_KEY || '');

export class SendGridProvider implements EmailProvider {
  async sendEmail({ to, subject, html, from, data, templateId }: EmailPayload): Promise<void> {
    if (templateId) {
      await sgMail.send({
        to,
        from: from || 'noreply@pyreprocessing.com',
        subject,
        templateId,
        dynamicTemplateData: data,
      });
    } else if (html) {
      await sgMail.send({
        to,
        from: from || 'noreply@pyreprocessing.com',
        subject,
        html,
      });
    } else {
      throw new ErrorUtil('Either html or templateId must be provided for sending email.', 400);
    }
  }
}
