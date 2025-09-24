// modules/notification/sms/TwilioProvider.ts
import twilio from 'twilio';
import { SMSPayload, SMSProvider } from './SMSProvider';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export class TwilioProvider implements SMSProvider {
  private client: twilio.Twilio;
  private defaultFromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.defaultFromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken) {
      throw new ErrorUtil('Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.', 500);
    }

    if (!this.defaultFromNumber) {
      throw new ErrorUtil('Twilio phone number not configured. Please set TWILIO_PHONE_NUMBER environment variable.', 500);
    }

    this.client = twilio(accountSid, authToken);
  }

  async sendSMS({ to, message, from, data }: SMSPayload): Promise<void> {
    try {
      // Validate phone number format (basic E.164 validation)
      if (!this.isValidPhoneNumber(to)) {
        throw new ErrorUtil(`Invalid phone number format: ${to}. Phone number must be in E.164 format (e.g., +1234567890).`, 400);
      }

      // Validate message content
      if (!message || message.trim().length === 0) {
        throw new ErrorUtil('SMS message content cannot be empty.', 400);
      }

      // Check message length (SMS limit is typically 160 characters for single SMS)
      if (message.length > 1600) {
        // Twilio supports up to 1600 chars but splits into multiple messages
        console.warn(`[TwilioProvider] Message length (${message.length}) exceeds recommended limit. Message will be split into multiple SMS.`);
      }

      const smsOptions: any = {
        body: message,
        from: from || this.defaultFromNumber,
        to: to,
      };

      // Add any additional Twilio-specific options from data
      if (data) {
        // Example: statusCallback, maxPrice, etc.
        if (data.statusCallback) smsOptions.statusCallback = data.statusCallback;
        if (data.maxPrice) smsOptions.maxPrice = data.maxPrice;
        if (data.validityPeriod) smsOptions.validityPeriod = data.validityPeriod;
      }

      const messageSid = await this.client.messages.create(smsOptions);

      console.log(`[TwilioProvider] SMS sent successfully. MessageSid: ${messageSid.sid}, To: ${to}`);
    } catch (error: any) {
      // Handle Twilio-specific errors
      if (error.code) {
        console.error(`[TwilioProvider] Twilio API Error ${error.code}: ${error.message}`);
        throw new ErrorUtil(`SMS sending failed: ${error.message}`, 400);
      } else if (error instanceof ErrorUtil) {
        // Re-throw our custom errors
        throw error;
      } else {
        console.error('[TwilioProvider] Unexpected error sending SMS:', error);
        throw new ErrorUtil('Failed to send SMS due to an unexpected error.', 500);
      }
    }
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic E.164 format validation: starts with + followed by country code and number
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }
}
