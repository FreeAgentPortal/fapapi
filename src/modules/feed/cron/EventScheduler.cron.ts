import cron from 'node-cron';
import { EventSchedulerHandler } from '../handlers/EventScheduler.handler';

export class EventSchedulerCron {
  private static isRunning = false;
  private static successCount = 0;
  private static failureCount = 0;
  /**
   * Initialize the event scheduler cron job
   * Runs every 5 minutes to check for events that need status updates
   */
  public static init(): void {
    console.info('[EventScheduler] Initializing event scheduler cron job(s)...');

    // Schedule to run every 5 minutes
    cron.schedule(
      '*/5 * * * *', // Every 5 minutes
      async () => {
        if (EventSchedulerCron.isRunning) {
          console.info('[EventScheduler] Previous job still running, skipping...');
          return;
        }

        EventSchedulerCron.isRunning = true;
        try {
          const result = await EventSchedulerHandler.processEvents();
          // set results for success/failure info
          EventSchedulerCron.successCount += result?.successCount || 0;
          EventSchedulerCron.failureCount += result?.errorCount || 0;

          // Only log if there were events processed or errors occurred
          if (result.totalProcessed > 0 || result.errorCount > 0) {
            console.info('[EventScheduler] Event processing completed:', result);
          }
        } catch (error) {
          console.error('[EventScheduler] Error in scheduled event processing:', error);
        } finally {
          EventSchedulerCron.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'event-scheduler',
      }
    );

    console.info('[EventScheduler] Event scheduler cron job initialized');
  }
  /**
   * Get status of the cron job
   */
  public static getStatus(): { isRunning: boolean; nextRun?: Date } {
    // Get next scheduled run time (next 5-minute interval)
    const now = new Date();
    const nextRun = new Date(now);

    // Calculate the next 5-minute mark
    const currentMinutes = now.getMinutes();
    const nextFiveMinuteMark = Math.ceil(currentMinutes / 5) * 5;

    if (nextFiveMinuteMark === 60) {
      // Roll over to next hour
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(0, 0, 0);
    } else {
      nextRun.setMinutes(nextFiveMinuteMark, 0, 0);
    }

    return {
      isRunning: EventSchedulerCron.isRunning,
      nextRun,
    };
  }
}
