import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';
import { ModelKey, ModelMap } from '../../../utils/ModelMap';
import { ITeamProfile } from '../../profiles/team/model/TeamModel';

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

  athleteViewRecorded = async (event: any) => {
    console.log(`[Notification]: Recording athlete view notification for athlete ${event.athleteId}`);
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
        await Notification.insertNotification(event.athleteId, undefined as any, `A new view on your profile has been recorded by ${viewerName}.`, 'TBD', 'athlete.view.recorded', event.viewerId);
      }
      await Notification.insertNotification(event.athleteId, undefined as any, 'A new view on your profile has been recorded.', 'TBD', 'athlete.view.recorded', event.viewerId);
    } catch (error) {
      console.error(`[Notification]: Error recording athlete view notification for athlete ${event.athleteId}:`, error);
      throw new ErrorUtil('Failed to record athlete view notification', 500);
    }
  };
}
