import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';
import { ModelKey, ModelMap } from '../../../utils/ModelMap';
import { ITeamProfile } from '../../profiles/team/model/TeamModel';
import { SMSService } from '../sms/SMSService';

export default class AthleteEventHandler {
  private modelMap: Record<ModelKey, Model<any>> = ModelMap;

  /**
   * Send profile incomplete email notification
   */
  private async sendProfileIncompleteEmail(event: any): Promise<void> {
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
      console.info(`[Notification]: Profile incomplete email sent to ${event.email}`);
    } catch (error) {
      console.error(`[Notification]: Error sending profile incomplete email to ${event.email}:`, error);
    }
  }

  /**
   * Send profile incomplete SMS notification
   * Expects notification settings to be passed in event data
   */
  private async sendProfileIncompleteSMS(event: any): Promise<void> {
    try {
      // Check if phone number is provided
      if (!event.phoneNumber) {
        console.warn(`[Notification]: No phone number provided for user ${event.userId}, skipping SMS notification`);
        return;
      }

      // Check the notificationSettings passed in the event
      if (!event.notificationSettings?.accountNotificationSMS) {
        console.info(`[Notification]: User ${event.userId} has [accountNotificationSMS] SMS alerts disabled, skipping SMS notification`);
        return;
      }

      // Send the SMS
      await SMSService.sendSMS({
        to: event.phoneNumber,
        data: {
          contentSid: 'HX762f1dc9c222adbc92383b2f53bdd222',
          contentVariables: {
            message: `Hello ${event.fullName}, our records indicate that your profile is incomplete. 
            Please update your profile to get the most out of our platform.
            Athlete's with a complete profile get 3x more views!
            Visit: https://athlete.thefreeagentportal.com/account_details/profile`,
          },
        },
      });
      console.info(`[Notification]: Profile incomplete SMS sent to ${event.phoneNumber}`);
    } catch (error) {
      console.error(`[Notification]: Error sending SMS to ${event.phoneNumber}:`, error);
    }
  }

  profileIncomplete = async (event: any) => {
    console.info(`[Notification]: Sending profile incomplete alert to ${event.email}`);

    // Send email and SMS notifications in parallel
    await Promise.all([this.sendProfileIncompleteEmail(event), this.sendProfileIncompleteSMS(event)]);

    console.info(`[Notification]: Profile incomplete alert processing completed for ${event.email}`);
  };

  athleteViewRecorded = async (event: any) => {
    console.info(`[Notification]: Recording athlete view notification for athlete ${event.athleteId}`);
    try {
      // we need to locate the profile, then locate the billing information
      const athleteProfile = await this.modelMap['athlete'].findById(event.athleteId).populate('user');
      if (!athleteProfile) {
        throw new ErrorUtil('Athlete profile not found', 404);
      }
      // next find the billing information
      const billingInfo = await this.modelMap['billing'].findOne({ profileId: athleteProfile._id });
      if (!billingInfo) {
        throw new ErrorUtil('Billing information not found for athlete', 404);
      }

      // determine if the athletes plan includes seeing who viewed their profile, or if its only
      // general information
      const plan = await this.modelMap['plan'].findById(billingInfo.planId);
      if (!plan) {
        throw new ErrorUtil('Plan information not found for athlete', 404);
      }
      const canSeeViewers = plan.features.includes('view_profile_viewers');
      if (canSeeViewers) {
        // get the viewer profile to include in the notification
        const viewerProfile = (await this.modelMap['team'].findById(event.viewerId).lean()) as any as ITeamProfile;
        if (!viewerProfile) {
          throw new ErrorUtil('Viewer profile not found', 404);
        }
        const viewerName = viewerProfile ? viewerProfile.name : 'A team';
        await Notification.insertNotification(
          event.athleteId,
          undefined as any,
          `A new view on your profile has been recorded by ${viewerName}.`,
          'TBD',
          'athlete.view.recorded',
          event.viewerId
        );
      }
      await Notification.insertNotification(event.athleteId, undefined as any, 'A new view on your profile has been recorded.', 'TBD', 'athlete.view.recorded', event.viewerId);
    } catch (error) {
      console.error(`[Notification]: Error recording athlete view notification for athlete ${event.athleteId}:`, error);
      throw new ErrorUtil('Failed to record athlete view notification', 500);
    }
  };
}
