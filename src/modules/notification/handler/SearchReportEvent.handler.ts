import { eventBus } from '../../../lib/eventBus';
import Notification from '../model/Notification';
import User from '../../auth/model/User';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { ModelMap } from '../utils/ModelMap';

export interface SearchReportEvent {
  _id: string; // Event ID
  userId: string;
  ownerType: 'team' | 'scout' | 'agent';
  searchPreferenceName: string;
  reportId: string;
  resultCount: number;
  generatedAt: Date;
}

export default class SearchReportEventHandler {
  /**
   * Handle the search report generated event
   */
  public onSearchReportGenerated = async (event: SearchReportEvent): Promise<void> => {
    try {
      console.log(`[SearchReportEventHandler] Processing report generated event for user: ${event.userId}`);

      // find the model we want to use with the modelMap
      const Model = ModelMap[event.ownerType];
      if (!Model) {
        throw new ErrorUtil(`Invalid owner type: ${event.ownerType}`, 400);
      }
      // Verify user exists
      const user = await Model.findById(event.userId);
      if (!user) {
        throw new ErrorUtil(`Owner not found: ${event.userId}`, 404);
      }

      // Create notification for the user
      await Notification.insertNotification(
        event.userId as any,
        undefined as any,
        'New Search Report Available',
        `Your search report for "${event.searchPreferenceName}" is ready with ${event.resultCount} results.`,
        'search.report',
        event._id as any
      );

      console.log(`[SearchReportEventHandler] Notification created for user ${event.userId} regarding report ${event.reportId}`);

      // TODO: Add email notification if user has email notifications enabled
      // await this.sendEmailNotification(user, event);
    } catch (error) {
      console.error('[SearchReportEventHandler] Error processing search report event:', error);
      // Don't throw - we don't want to break the report generation process
    }
  };

  /**
   * Send email notification (placeholder for future implementation)
   */
  private static async sendEmailNotification(user: any, event: SearchReportEvent): Promise<void> {
    // TODO: Implement email notification using your EmailService
    // Example:
    /*
    await EmailService.sendEmail({
      to: user.email,
      subject: 'New Search Report Available',
      templateId: 'search-report-notification',
      data: {
        firstName: user.firstName,
        searchName: event.searchPreferenceName,
        resultCount: event.resultCount,
        reportLink: `${process.env.FRONTEND_URL}/reports/${event.reportId}`,
        currentYear: new Date().getFullYear()
      }
    });
    */

    console.log(`[SearchReportEventHandler] Email notification would be sent to ${user.email} for report ${event.reportId}`);
  }
}
