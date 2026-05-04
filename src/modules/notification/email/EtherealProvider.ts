import nodemailer from 'nodemailer';
import { EmailProvider, EmailPayload } from './EmailProvider';

export class EtherealProvider implements EmailProvider {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });
  }

  async sendEmail({ to, subject, html, from }: EmailPayload): Promise<void> {
    const info = await this.transporter.sendMail({
      from: from || 'no-reply@freeagentportal.dev',
      to,
      subject,
      html,
    });
    console.info('📧 Ethereal preview URL:', nodemailer.getTestMessageUrl(info));
  }
}
