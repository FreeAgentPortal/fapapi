// modules/notification/sms/SMSService.ts
import { SMSPayload, SMSProvider } from './SMSProvider';
import { TwilioProvider } from './TwilioProvider';
// Add other SMS providers as needed:
// import { MockSMSProvider } from './MockSMSProvider';

class SMSService {
  private static provider: SMSProvider;

  static init(providerName: 'twilio' | 'mock' = 'twilio') {
    switch (providerName) {
      case 'twilio':
        this.provider = new TwilioProvider();
        break;
      // case 'mock':
      //   this.provider = new MockSMSProvider();
      //   break;
      default:
        throw new Error(`Unknown SMS provider: ${providerName}`);
    }

    console.log(`[SMSService] Initialized with provider: ${providerName}`);
  }

  static async sendSMS(payload: SMSPayload): Promise<void> {
    if (!this.provider) {
      throw new Error('SMS provider not initialized. Call SMSService.init() first.');
    }

    console.log(`[SMSService] Sending SMS to ${payload.to}`);
    await this.provider.sendSMS(payload);
  }

  /**
   * Utility method to format phone numbers to E.164 format
   * @param phoneNumber - Phone number in various formats
   * @param countryCode - Default country code (e.g., 'US', 'CA')
   * @returns Formatted phone number in E.164 format
   */
  static formatPhoneNumber(phoneNumber: string, countryCode: string = 'US'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');

    // Handle US/Canada numbers (country code 1)
    if (countryCode === 'US' || countryCode === 'CA') {
      if (digits.length === 10) {
        return `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
      }
    }

    // If already in E.164 format or starts with +, return as is
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }

    // For other cases, return with + prefix
    return `+${digits}`;
  }

  /**
   * Utility method to validate phone number format
   * @param phoneNumber - Phone number to validate
   * @returns true if valid E.164 format
   */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }
}

export { SMSService };
