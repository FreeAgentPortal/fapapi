import { Model } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import Notification from '../model/Notification';
import { ModelMap } from '../../../utils/ModelMap';

export default class ScoutEventsHandler {
  modelMap: Record<string, Model<any>> = ModelMap;
  async scoutReviewCompleted(event: any) {
    const athlete = await this.modelMap['athlete'].findById(event.athleteId).select('userId');
    if (!athlete) return;
    await Notification.insertNotification(athlete.userId, null as any, 'Scout feedback available',
      event.status === 'declined' ? 'A scout left feedback explaining why they could not rate this portfolio.' : 'A scout left feedback and submitted a report for approval.',
      'scout_review', event.reviewId, `scout-review:${event.reviewId}`);
  }

  async scoutReportDecided(event: any) {
    const [athlete, scout] = await Promise.all([
      this.modelMap['athlete'].findById(event.athleteId).select('userId'),
      this.modelMap['scout_profile'].findById(event.scoutId).select('user'),
    ]);
    if (athlete && event.isApproved) {
      await Notification.insertNotification(athlete.userId, null as any, 'Scout report approved',
        'Your new scout report is available.', 'scout_report', event.reportId, `scout-report:${event.reportId}:athlete`);
    }
    if (scout) {
      await Notification.insertNotification(scout.user, null as any, 'Scout report processed',
        `Your scout report was ${event.isApproved ? 'approved' : 'denied'}.`, 'scout_report', event.reportId, `scout-report:${event.reportId}:scout`);
    }
  }
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
    const scoutProfile = await this.modelMap['scout_profile'].findById(event.scoutId);
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
