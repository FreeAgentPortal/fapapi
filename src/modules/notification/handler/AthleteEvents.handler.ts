import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';
import { ModelKey, ModelMap } from '../../../utils/ModelMap';

export default class AthleteEventHandler {
  private modelMap: Record<ModelKey, Model<any>> = ModelMap;

  profileIncomplete = async (event: any) => {
    console.log(`[Notification]: Sending profile incomplete alert to ${event.email}`);
    console.log(event);
    // use the email service to send an email
    try {
      await EmailService.sendEmail({
        to: event.email,
        subject: 'Profile Incomplete',
        templateId: 'd-f807153c7f5142e3963652e9b71feee9',
        data: {
          ...event,
          subject: 'Profile Incomplete',
          profileUrl: `https://athlete.thefreeagentportal.com/account_details/profile`,
          currentYear: new Date().getFullYear(),
        },
      });
    } catch (error) {
      console.error(`[Notification]: Error sending profile incomplete alert to ${event.email}:`, error);
    }
    console.log(`[Notification]: Profile incomplete alert sent to ${event.email}`);
  };
}
