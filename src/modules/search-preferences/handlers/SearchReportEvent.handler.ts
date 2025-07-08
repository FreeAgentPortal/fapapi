import { eventBus } from '../../../lib/eventBus';
import Notification from '../../notification/model/Notification';
import User from '../../auth/model/User';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export interface SearchReportEvent {
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
  public static async onSearchReportGenerated(event: SearchReportEvent): Promise<void> {
    try {
      console.log(`[SearchReportEventHandler] Processing report generated event for user: ${event.userId}`);

      // Verify user exists
      const user = await User.findById(event.userId);
      if (!user) {
        throw new ErrorUtil(`User not found: ${event.userId}`, 404);
      }

      // Create notification for the user
      await Notification.insertNotification(
        event.userId as any,
        event.userId as any, // Self-notification for system-generated reports
        'New Search Report Available',
        `Your search report for "${event.searchPreferenceName}" is ready with ${event.resultCount} results.`,
        'search.report',
        event.reportId as any
      );

      console.log(`[SearchReportEventHandler] Notification created for user ${event.userId} regarding report ${event.reportId}`);

      // TODO: Add email notification if user has email notifications enabled
      // await this.sendEmailNotification(user, event);
    } catch (error) {
      console.error('[SearchReportEventHandler] Error processing search report event:', error);
      // Don't throw - we don't want to break the report generation process
    }
  }

  /**
   * Initialize event listeners
   */
  public static init(): void {
    console.log('[SearchReportEventHandler] Initializing search report event handlers...');

    eventBus.subscribe('search.report.generated', SearchReportEventHandler.onSearchReportGenerated);

    console.log('[SearchReportEventHandler] Event handlers initialized');
  }

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
