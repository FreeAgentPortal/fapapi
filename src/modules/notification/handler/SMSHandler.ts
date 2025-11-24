// modules/notification/handler/SMSHandler.ts
import { Request, Response } from 'express';
import { SMSService } from '../sms/SMSService';
import asyncHandler from '../../../middleware/asyncHandler';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export class SMSHandler {
  /**
   * Test SMS sending functionality
   * POST /api/v1/notifications/sms/test
   * Body: { to: string, message: string, from?: string }
   */
  static testSMS = asyncHandler(async (req: Request, res: Response) => {
    const { message, from, data } = req.body;
    let { to } = req.body;

    // Validation
    if (!to) {
      throw new ErrorUtil('Missing required field: to is required', 400);
    }

    // Message is required unless using a template
    const usingTemplate = data?.contentSid || data?.messagingServiceSid;
    if (!usingTemplate && !message) {
      throw new ErrorUtil('Message is required when not using a template', 400);
    }

    // Validate phone number format
    if (!SMSService.isValidPhoneNumber(to)) {
      // if not valid, attempt to format it
      const formattedNumber = SMSService.formatPhoneNumber(to);
      console.log(formattedNumber);
      if (!SMSService.isValidPhoneNumber(formattedNumber)) {
        throw new ErrorUtil('Invalid phone number format. Use E.164 format (e.g., +1234567890)', 400);
      }
      to = formattedNumber;
    }

    // Validate message length
    if (message && message.length > 1600) {
      throw new ErrorUtil('Message too long. Maximum length is 1600 characters', 400);
    }

    try {
      await SMSService.sendSMS({
        to,
        data: { contentSid: 'HX762f1dc9c222adbc92383b2f53bdd222', contentVariables: { message: message } },
      });

      res.status(200).json({
        success: true,
        message: 'SMS sent successfully',
        data: {
          to,
          messageLength: message.length,
          from: from || 'default',
        },
      });
    } catch (error: any) {
      console.error('[SMSHandler] Error sending test SMS:', error);
      throw new ErrorUtil(`Failed to send SMS: ${error.message}`, 500);
    }
  });

  /**
   * Format phone number to E.164 format
   * POST /api/v1/notifications/sms/format-phone
   * Body: { phoneNumber: string, countryCode?: string }
   */
  static formatPhoneNumber = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, countryCode = 'US' } = req.body;

    if (!phoneNumber) {
      throw new ErrorUtil('Phone number is required', 400);
    }

    try {
      const formattedNumber = SMSService.formatPhoneNumber(phoneNumber, countryCode);
      const isValid = SMSService.isValidPhoneNumber(formattedNumber);

      res.status(200).json({
        success: true,
        data: {
          original: phoneNumber,
          formatted: formattedNumber,
          isValid,
          countryCode,
        },
      });
    } catch (error: any) {
      console.error('[SMSHandler] Error formatting phone number:', error);
      throw new ErrorUtil(`Failed to format phone number: ${error.message}`, 400);
    }
  });

  /**
   * Send SMS with template data (for future template support)
   * POST /api/v1/notifications/sms/send
   * Body: { to: string, message: string, from?: string, data?: Record<string, any> }
   */
  static sendSMS = asyncHandler(async (req: Request, res: Response) => {
    const { message, from, data } = req.body;
    let { to } = req.body;

    // Validation
    if (!to) {
      throw new ErrorUtil('Missing required field: to is required', 400);
    }

    // Message is required unless using a template
    const usingTemplate = data?.contentSid || data?.messagingServiceSid;
    if (!usingTemplate && !message) {
      throw new ErrorUtil('Message is required when not using a template', 400);
    }

    // Validate phone number format
    if (!SMSService.isValidPhoneNumber(to)) {
      // if not valid, attempt to format it
      const formattedNumber = SMSService.formatPhoneNumber(to);
      if (!SMSService.isValidPhoneNumber(formattedNumber)) {
        throw new ErrorUtil('Invalid phone number format. Use E.164 format (e.g., +1234567890)', 400);
      }
      to = formattedNumber;
    }

    // Validate message length
    if (message && message.length > 1600) {
      throw new ErrorUtil('Message too long. Maximum length is 1600 characters', 400);
    }

    try {
      await SMSService.sendSMS({
        to,
        message,
        from,
        data,
      });

      res.status(200).json({
        success: true,
        message: 'SMS sent successfully',
        data: {
          to,
          messageLength: message.length,
          from: from || 'default',
          additionalData: data || null,
        },
      });
    } catch (error: any) {
      console.error('[SMSHandler] Error sending SMS:', error);
      throw new ErrorUtil(`Failed to send SMS: ${error.message}`, 500);
    }
  });

  /**
   * Get SMS service health/status
   * GET /api/v1/notifications/sms/health
   */
  static getHealth = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Check if SMS service is initialized and basic environment variables exist
      const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

      res.status(200).json({
        success: true,
        message: 'SMS service health check',
        data: {
          serviceInitialized: true, // We can't easily check this without trying to access the private provider
          twilioConfigured,
          environment: {
            hasSid: !!process.env.TWILIO_ACCOUNT_SID,
            hasToken: !!process.env.TWILIO_AUTH_TOKEN,
            hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
          },
        },
      });
    } catch (error: any) {
      console.error('[SMSHandler] Error checking SMS health:', error);
      throw new ErrorUtil(`SMS health check failed: ${error.message}`, 500);
    }
  });
}
