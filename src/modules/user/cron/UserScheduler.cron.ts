import cron from 'node-cron';

export class AuthScheduler {
  private static isRunning = false;

  /**
   * Initialize the athlete profile completion reminder cron job
   * Runs daily at 9:00 AM
   */
  public static init(): void {
    console.info('[AuthScheduler] Initializing...');

    // Schedule to run daily at 9:00 AM
    cron.schedule(
      '0 9 * * *', // At 09:00 every day
      async () => {
        if (AuthScheduler.isRunning) {
          console.info('[AuthScheduler] Previous job still running, skipping...');
          return;
        }

        AuthScheduler.isRunning = true;
        try {
          console.info('[AuthScheduler] Starting scheduled Auth process..');
 
          console.info('[AuthScheduler] Scheduled Auth process completed');
        } catch (error) {
          console.error('[AuthScheduler] Error in athlete profile completion alerts:', error);
        } finally {
          AuthScheduler.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'athlete-profile-completion-alerts',
      }
    );

    console.info('[AuthScheduler] Athlete profile completion reminder cron job initialized');
  }

  /**
   * Manual trigger for testing purposes
   */
  public static async triggerManualCompletionAlerts(athleteId?: string): Promise<void> {
    console.info('[AuthScheduler] Manual completion alerts triggered');

    try {
    } catch (error) {
      console.error('[AuthScheduler] Error in manual completion alerts:', error);
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
      isRunning: AuthScheduler.isRunning,
      nextRun,
    };
  }
}
