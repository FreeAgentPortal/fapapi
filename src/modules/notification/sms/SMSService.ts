// modules/notification/sms/SMSService.ts
import { SMSPayload, SMSProvider } from './SMSProvider';
import { TwilioProvider } from './TwilioProvider';
import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';
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

    // check the number to make sure its valid; if not, format it
    if (!this.isValidPhoneNumber(payload.to)) {
      const formattedNumber = this.formatPhoneNumber(payload.to);
      payload.to = formattedNumber;
      console.log(`[SMSService] Formatted phone number to E.164: ${formattedNumber}`);
      // check again to ensure formatting worked
      if (!this.isValidPhoneNumber(payload.to)) {
        throw new Error(`Invalid phone number after formatting: ${payload.to}`);
      }
    }

    console.log(`[SMSService] Sending SMS to ${payload.to}`);
    await this.provider.sendSMS(payload);
  }

  /**
   * Utility method to format phone numbers to E.164 format using google-libphonenumber
   * @param phoneNumber - Phone number in various formats
   * @param defaultRegion - Default region code (e.g., 'US', 'CA', 'GB'). Defaults to 'US'
   * @returns Formatted phone number in E.164 format
   * @throws Error if phone number cannot be parsed or formatted
   */
  static formatPhoneNumber(phoneNumber: string, defaultRegion: string = 'US'): string {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    const phoneUtil = PhoneNumberUtil.getInstance();

    try {
      // Trim whitespace
      const trimmed = phoneNumber.trim();

      // Parse the phone number
      const parsedNumber = phoneUtil.parse(trimmed, defaultRegion);

      // Validate the parsed number
      if (!phoneUtil.isValidNumber(parsedNumber)) {
        throw new Error(`Invalid phone number: ${phoneNumber}`);
      }

      // Format to E.164
      return phoneUtil.format(parsedNumber, PhoneNumberFormat.E164);
    } catch (error) {
      throw new Error(`Failed to format phone number "${phoneNumber}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Utility method to validate phone number using google-libphonenumber
   * Can validate numbers in various formats and regions
   *
   * @param phoneNumber - Phone number to validate
   * @param defaultRegion - Default region code (e.g., 'US', 'CA', 'GB'). Defaults to 'US'
   * @returns true if valid phone number
   */
  static isValidPhoneNumber(phoneNumber: string, defaultRegion: string = 'US'): boolean {
    if (!phoneNumber) {
      return false;
    }

    const phoneUtil = PhoneNumberUtil.getInstance();

    try {
      const parsedNumber = phoneUtil.parse(phoneNumber.trim(), defaultRegion);
      return phoneUtil.isValidNumber(parsedNumber);
    } catch (error) {
      return false;
    }
  }
}

export { SMSService };
