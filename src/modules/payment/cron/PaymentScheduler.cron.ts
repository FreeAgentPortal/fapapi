import cron from 'node-cron';
import PaymentProcessingHandler from '../handlers/PaymentProcessing.handler';

export class PaymentSchedulerCron {
  private static isRunning = false;
  private static successCount = 0;
  private static failureCount = 0;


  /**
   * Initialize the payment processing cron job
   * Runs daily at 9:00 AM
   */
  public static init(): void {
    console.log('[PaymentScheduler] Initializing payment processing cron job...');

    // Schedule to run daily at 9:00 AM
    cron.schedule(
      '0 9 * * *', // At 09:00 every day
      async () => {
        if (PaymentSchedulerCron.isRunning) {
          console.log('[PaymentScheduler] Previous job still running, skipping...');
          return;
        }

        PaymentSchedulerCron.isRunning = true;
        try {
          console.log('[PaymentScheduler] Starting scheduled payment processing...');
          // Call the payment processing handler
          const result = await PaymentProcessingHandler.processScheduledPayments();

          // set results for success/failure logging
          if (result.success) {
            PaymentSchedulerCron.successCount += result.results.successCount || 0;
            PaymentSchedulerCron.failureCount += result.results.failureCount || 0;
          }
          console.log('[PaymentScheduler] Scheduled payment processing completed:', result);
        } catch (error) {
          console.error('[PaymentScheduler] Error in scheduled payment processing:', error);
        } finally {
          PaymentSchedulerCron.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'payment-processing',
      }
    );

    console.log('[PaymentScheduler] Payment processing cron job initialized');
  }

  /**
   * Get status of the cron job
   */
  public static getStatus(): { isRunning: boolean; nextRun?: Date, successCount: number; failureCount: number } {
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
      isRunning: PaymentSchedulerCron.isRunning,
      nextRun,
      successCount: PaymentSchedulerCron.successCount,
      failureCount: PaymentSchedulerCron.failureCount,
    };
  }
}
