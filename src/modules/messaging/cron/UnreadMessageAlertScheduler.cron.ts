import cron from 'node-cron';
import { UnreadMessageAlertHandler } from '../handlers/UnreadMessageAlertHandler';

export class UnreadMessageAlertScheduler {
  private static isRunning = false;

  /**
   * Initialize the unread message alert cron job
   * Runs every 30 minutes to check for unread messages older than 2 hours
   */
  public static init(): void {
    console.info('[UnreadMessageAlertScheduler] Initializing unread message alert cron job...');

    // Schedule to run every 30 minutes
    cron.schedule(
      '*/30 * * * *', // Every 30 minutes
      async () => {
        if (UnreadMessageAlertScheduler.isRunning) {
          console.info('[UnreadMessageAlertScheduler] Previous job still running, skipping...');
          return;
        }

        UnreadMessageAlertScheduler.isRunning = true;
        try {
          console.info('[UnreadMessageAlertScheduler] Starting scheduled unread message alerts...');

          const result = await UnreadMessageAlertHandler.processUnreadMessageAlerts();

          console.info('[UnreadMessageAlertScheduler] Scheduled alerts completed:', result);
        } catch (error) {
          console.error('[UnreadMessageAlertScheduler] Error in unread message alerts:', error);
        } finally {
          UnreadMessageAlertScheduler.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'unread-message-alerts',
      }
    );

    console.info('[UnreadMessageAlertScheduler] Unread message alert cron job initialized (runs every 30 minutes)');
  }

  /**
   * Manual trigger for testing purposes
   */
  public static async triggerManualAlerts(messageId?: string): Promise<void> {
    console.info('[UnreadMessageAlertScheduler] Manual alerts triggered');

    try {
      if (messageId) {
        // Send alert for specific message
        await UnreadMessageAlertHandler.processSpecificMessageAlert(messageId);
        console.info(`[UnreadMessageAlertScheduler] Manual alert sent for message: ${messageId}`);
      } else {
        // Process all unread messages
        console.info('[UnreadMessageAlertScheduler] Processing manual alerts for all unread messages...');
        const result = await UnreadMessageAlertHandler.processUnreadMessageAlerts();
        console.info('[UnreadMessageAlertScheduler] Manual alerts completed:', result);
      }
    } catch (error) {
      console.error('[UnreadMessageAlertScheduler] Error in manual alerts:', error);
      throw error;
    }
  }

  /**
   * Get status of the cron job
   */
  public static getStatus(): { isRunning: boolean; schedule: string } {
    return {
      isRunning: UnreadMessageAlertScheduler.isRunning,
      schedule: 'Every 30 minutes',
    };
  }
}
