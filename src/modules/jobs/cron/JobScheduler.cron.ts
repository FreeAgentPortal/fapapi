import cron from 'node-cron';
import JobExpirationHandler from '../handlers/JobExpirationHandler';

export class JobSchedulerCron {
  private static isRunning = false;
  private static totalClosed = 0;

  /**
   * Initialize the job expiration cron job.
   * Runs daily at midnight (00:00) to close any published jobs whose
   * expiresAt date has passed.
   */
  public static init(): void {
    console.info('[JobScheduler] Initializing job expiration cron job...');

    cron.schedule(
      '0 0 * * *', // At 00:00 every day
      async () => {
        if (JobSchedulerCron.isRunning) {
          console.info('[JobScheduler] Previous job still running, skipping...');
          return;
        }

        JobSchedulerCron.isRunning = true;
        try {
          console.info('[JobScheduler] Starting scheduled job expiration check...');
          const result = await JobExpirationHandler.closeExpiredJobs();

          if (result.success) {
            JobSchedulerCron.totalClosed += result.closed;
          }

          console.info(`[JobScheduler] Job expiration check completed: ${result.closed} job(s) closed.`);
        } catch (error) {
          console.error('[JobScheduler] Error during job expiration check:', error);
        } finally {
          JobSchedulerCron.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'job-expiration',
      }
    );

    console.info('[JobScheduler] Job expiration cron job initialized');
  }

  /**
   * Manually trigger the job expiration check.
   * Use for testing or admin-initiated runs outside of the scheduled window.
   */
  public static async triggerManualExpiration(): Promise<{ closed: number }> {
    console.info('[JobScheduler] Manual job expiration check triggered');

    const result = await JobExpirationHandler.closeExpiredJobs();

    if (result.success) {
      JobSchedulerCron.totalClosed += result.closed;
    }

    console.info(`[JobScheduler] Manual expiration check completed: ${result.closed} job(s) closed.`);
    return { closed: result.closed };
  }

  /**
   * Get the current status of the cron job.
   */
  public static getStatus(): { isRunning: boolean; nextRun: Date; totalClosed: number } {
    const now = new Date();
    const nextRun = new Date(now);

    // Next midnight
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(0, 0, 0, 0);

    return {
      isRunning: JobSchedulerCron.isRunning,
      nextRun,
      totalClosed: JobSchedulerCron.totalClosed,
    };
  }
}
