// modules/notification/email/EmailProvider.ts
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailProvider {
  sendEmail(payload: EmailPayload): Promise<void>;
}
