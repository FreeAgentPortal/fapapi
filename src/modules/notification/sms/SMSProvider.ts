// modules/notification/sms/SMSProvider.ts
export interface SMSPayload {
  to: string; // Phone number in E.164 format (e.g., +1234567890)
  message: string; // SMS message content
  from?: string; // Optional sender phone number (uses provider default if not specified)
  data?: Record<string, any>; // Optional data for templating or additional provider options
}

export interface SMSProvider {
  sendSMS(payload: SMSPayload): Promise<void>;
}
