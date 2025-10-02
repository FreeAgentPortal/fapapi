import cron from 'node-cron';
import { AthleteProfileAnalysisHandler } from '../handlers/AthleteProfileAnalysisHandler';

export class AthleteSchedulerCron {
  private static isRunning = false;

  /**
   * Initialize the athlete profile completion reminder cron job
   * Runs daily at 9:00 AM
   */
  public static init(): void {
    console.info('[AthleteScheduler] Initializing athlete profile completion reminder cron job...');

    // Schedule to run daily at 9:00 AM
    cron.schedule(
      '0 9 * * *', // At 09:00 every day
      async () => {
        if (AthleteSchedulerCron.isRunning) {
          console.info('[AthleteScheduler] Previous job still running, skipping...');
          return;
        }

        AthleteSchedulerCron.isRunning = true;
        try {
          console.info('[AthleteScheduler] Starting scheduled athlete profile completion alerts...');

          const result = await AthleteProfileAnalysisHandler.processCompletionAlerts();

          console.info('[AthleteScheduler] Scheduled completion alerts completed:', result);
        } catch (error) {
          console.error('[AthleteScheduler] Error in athlete profile completion alerts:', error);
        } finally {
          AthleteSchedulerCron.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'athlete-profile-completion-alerts',
      }
    );

    console.info('[AthleteScheduler] Athlete profile completion reminder cron job initialized');
  }

  /**
   * Manual trigger for testing purposes
   */
  public static async triggerManualCompletionAlerts(athleteId?: string): Promise<void> {
    console.info('[AthleteScheduler] Manual completion alerts triggered');

    try {
      if (athleteId) {
        // Send alert for specific athlete
        await AthleteProfileAnalysisHandler.processSpecificAthleteAlert(athleteId);
        console.info(`[AthleteScheduler] Manual completion alert sent for athlete: ${athleteId}`);
      } else {
        // Send alerts for all incomplete profiles
        console.info('[AthleteScheduler] Processing manual alerts for all incomplete profiles...');
        const result = await AthleteProfileAnalysisHandler.processCompletionAlerts();
        console.info('[AthleteScheduler] Manual completion alerts completed:', result);
      }
    } catch (error) {
      console.error('[AthleteScheduler] Error in manual completion alerts:', error);
      throw error;
    }
  }

  /**
   * Get status of the cron job
   */
  public static getStatus(): { isRunning: boolean; nextRun?: Date } {
    // Get next scheduled run time (9:00 AM next day)
    const now = new Date();
    const nextRun = new Date(now);

    // If it's before 9 AM today, next run is today at 9 AM
    if (now.getHours() < 9) {
      nextRun.setHours(9, 0, 0, 0);
    } else {
      // Otherwise, next run is tomorrow at 9 AM
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(9, 0, 0, 0);
    }

    return {
      isRunning: AthleteSchedulerCron.isRunning,
      nextRun,
    };
  }
}
