import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';
import { ModelMap } from '../../../utils/ModelMap';

export default class ScoutEventsHandler {
  modelMap: Record<string, Model<any>> = ModelMap;
  async scoutReportSubmitted(event: any) {
    const { reportId, athleteId, isApproved } = event;
    if (!reportId || !athleteId) {
      throw new ErrorUtil('Report ID and Athlete ID are required for scout report submitted event handling', 400);
    }
    console.info(`[Notification] Scout report submitted with ID: ${reportId}, Athlete ID: ${athleteId}, Approved: ${isApproved}`);

    // notify the athlete about the report submission, You've been scouted!
    await Notification.insertNotification(
      athleteId as any,
      null as any,
      'Scout Report Submitted',
      `You've been scouted! Your getting noticed by scouts!`,
      'system',
      reportId as any
    );

    // next alert the scout who submitted the report that their report was successfully submitted
    const scoutProfile = await this.modelMap['scout_profile'].findById({ user: event.scoutId });
    if (scoutProfile) {
      await Notification.insertNotification(
        scoutProfile._id,
        null as any,
        'Scout Report Processed',
        `Your scout Report: ${reportId} has been successfully processed, and was ${isApproved ? 'approved' : 'denied'}.`,
        'scout_report',
        reportId as any
      );
    }
    
  }
}
