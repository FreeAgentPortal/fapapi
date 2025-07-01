// modules/notification/email/EmailProvider.ts
export interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  from?: string;
  data?: Record<string, any>; // Optional data for templating
  templateId?: string; // Optional template ID for provider-specific templates
}

export interface EmailProvider {
  sendEmail(payload: EmailPayload): Promise<void>;
}
