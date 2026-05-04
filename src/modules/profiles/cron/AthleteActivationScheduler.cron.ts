import cron from 'node-cron';
import { AthleteActivationHandler } from '../handlers/AthleteActivationHandler';

export class AthleteActivationSchedulerCron {
  private static isRunning = false;

  /**
   * Initialize the athlete profile activation management cron job
   * Runs daily at 2:00 AM (before completion alerts)
   */
  public static init(): void {
    console.info('[AthleteActivationScheduler] Initializing athlete profile activation management cron job...');

    // Schedule to run daily at 2:00 AM
    cron.schedule(
      '0 2 * * *', // At 02:00 every day
      async () => {
        if (AthleteActivationSchedulerCron.isRunning) {
          console.info('[AthleteActivationScheduler] Previous job still running, skipping...');
          return;
        }

        AthleteActivationSchedulerCron.isRunning = true;
        try {
          console.info('[AthleteActivationScheduler] Starting scheduled profile activation management...');

          const result = await AthleteActivationHandler.manageProfileActivation();

          console.info('[AthleteActivationScheduler] Scheduled profile activation management completed:', result);
        } catch (error) {
          console.error('[AthleteActivationScheduler] Error in profile activation management:', error);
        } finally {
          AthleteActivationSchedulerCron.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'athlete-profile-activation-management',
      }
    );

    console.info('[AthleteActivationScheduler] Profile activation management cron job initialized');
  }

  /**
   * Manual trigger for profile activation management
   */
  public static async triggerManualProfileManagement(): Promise<{
    deactivation: { successCount: number; errorCount: number; totalProcessed: number };
    reactivation: { successCount: number; errorCount: number; totalProcessed: number };
  }> {
    console.info('[AthleteActivationScheduler] Manual profile activation management triggered');

    try {
      if (AthleteActivationSchedulerCron.isRunning) {
        throw new Error('Profile management job is already running');
      }

      AthleteActivationSchedulerCron.isRunning = true;
      console.info('[AthleteActivationScheduler] Processing manual profile activation management...');

      const result = await AthleteActivationHandler.manageProfileActivation();
      console.info('[AthleteActivationScheduler] Manual profile activation management completed:', result);

      return result;
    } catch (error) {
      console.error('[AthleteActivationScheduler] Error in manual profile activation management:', error);
      throw error;
    } finally {
      AthleteActivationSchedulerCron.isRunning = false;
    }
  }

  /**
   * Manual trigger for deactivating zero-work profiles only
   */
  public static async triggerManualDeactivation(): Promise<{ successCount: number; errorCount: number; totalProcessed: number }> {
    console.info('[AthleteActivationScheduler] Manual profile deactivation triggered');

    try {
      const result = await AthleteActivationHandler.deactivateZeroWorkProfiles();
      console.info('[AthleteActivationScheduler] Manual profile deactivation completed:', result);
      return result;
    } catch (error) {
      console.error('[AthleteActivationScheduler] Error in manual profile deactivation:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for reactivating completed profiles only
   */
  public static async triggerManualReactivation(): Promise<{ successCount: number; errorCount: number; totalProcessed: number }> {
    console.info('[AthleteActivationScheduler] Manual profile reactivation triggered');

    try {
      const result = await AthleteActivationHandler.reactivateCompletedProfiles();
      console.info('[AthleteActivationScheduler] Manual profile reactivation completed:', result);
      return result;
    } catch (error) {
      console.error('[AthleteActivationScheduler] Error in manual profile reactivation:', error);
      throw error;
    }
  }

  /**
   * Get status of the profile activation management cron job
   */
  public static getStatus(): { isRunning: boolean; nextRun?: Date } {
    const now = new Date();

    // Get next scheduled run time for profile management (2:00 AM)
    const nextRun = new Date(now);
    if (now.getHours() < 2) {
      nextRun.setHours(2, 0, 0, 0);
    } else {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(2, 0, 0, 0);
    }

    return {
      isRunning: AthleteActivationSchedulerCron.isRunning,
      nextRun,
    };
  }
}
