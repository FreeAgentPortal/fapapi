import cron from 'node-cron';
import SearchPreferences, { ISearchPreferences } from '../models/SearchPreferences';
import { SchedulerHandler } from '../handlers/Scheduler.handler';

export class ReportSchedulerCron {
  private static isRunning = false;
  // keep a running total of success and failures
  private static successCount = 0;
  private static errorCount = 0;

  /**
   * Initialize the daily report generation cron job
   * Runs once daily at midnight
   */
  public static init(): void {
    console.info('[ReportScheduler] Initializing daily report generation cron job...');

    // Schedule to run daily at midnight (00:00)
    cron.schedule(
      '0 0 * * *', // At 00:00 every day
      async () => {
        if (ReportSchedulerCron.isRunning) {
          console.info('[ReportScheduler] Previous job still running, skipping...');
          return;
        }

        ReportSchedulerCron.isRunning = true;
        try {
          await ReportSchedulerCron.processDailyReports();
        } catch (error) {
          console.error('[ReportScheduler] Error in daily report generation:', error);
        } finally {
          ReportSchedulerCron.isRunning = false;
        }
      },
      {
        timezone: 'America/Los_Angeles',
        name: 'daily-search-reports',
      }
    );

    console.info('[ReportScheduler] Daily report generation cron job initialized');
  }

  /**
   * Process all search preferences that are due for report generation
   */
  public static async processDailyReports(): Promise<void> {
    console.info('[ReportScheduler] Starting daily report generation process...');

    try {
      // Reset totals
      ReportSchedulerCron.successCount = 0;
      ReportSchedulerCron.errorCount = 0;

      // Get all search preferences that are ready for report generation
      const duePreferences = await ReportSchedulerCron.getDueSearchPreferences();

      if (duePreferences.length === 0) {
        console.info('[ReportScheduler] No search preferences due for report generation');
        return;
      }

      console.info(`[ReportScheduler] Found ${duePreferences.length} search preferences due for reports\n`);

      // Process each search preference
      let successCount = 0;
      let errorCount = 0;

      for (const preference of duePreferences) {
        try {
          const data = await SchedulerHandler.generateReport(preference);

          // Update the dateLastRan field
          await SearchPreferences.findByIdAndUpdate(preference._id, { dateLastRan: new Date(), numberOfResults: data.results.length }, { new: true });

          successCount++;
        } catch (error) {
          console.error(`[ReportScheduler] Error generating report for preference ${preference._id}:`, error);
          errorCount++;
        }
      }

      ReportSchedulerCron.successCount += successCount;
      ReportSchedulerCron.errorCount += errorCount;

      console.info(`[ReportScheduler] Daily report generation completed. Success: ${successCount}, Errors: ${errorCount}`);
    } catch (error) {
      console.error('[ReportScheduler] Error in processDailyReports:', error);
      throw error;
    }
  }

  /**
   * Get search preferences that are due for report generation
   * Based on frequency, frequencyType, and dateLastRan
   */
  private static async getDueSearchPreferences(): Promise<ISearchPreferences[]> {
    const now = new Date();

    try {
      // Build query to find preferences that are due
      const query = {
        $and: [
          // Must have frequency greater than 0 (0 means disabled)
          { frequency: { $gt: 0 } },
          // Must have a frequency type
          { frequencyType: { $in: ['daily', 'weekly', 'monthly'] } },
          // Either never run before OR due based on frequency
          {
            $or: [
              // Never run before
              { dateLastRan: { $exists: false } },
              { dateLastRan: null },
              // Due based on frequency
              ...ReportSchedulerCron.buildFrequencyQueries(now),
            ],
          },
        ],
      };

      const duePreferences = await SearchPreferences.find(query).populate('ownerId', 'email firstName lastName fullName').lean();

      return duePreferences as ISearchPreferences[];
    } catch (error) {
      console.error('[ReportScheduler] Error fetching due search preferences:', error);
      throw error;
    }
  }

  /**
   * Build MongoDB queries for different frequency types
   */
  private static buildFrequencyQueries(now: Date): any[] {
    const queries = [];

    // Daily: Last run was before today
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    queries.push({
      frequencyType: 'daily',
      dateLastRan: { $lt: startOfToday },
    });

    // Weekly: Last run was more than 7 days ago
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    queries.push({
      frequencyType: 'weekly',
      dateLastRan: { $lt: weekAgo },
    });

    // Monthly: Last run was more than 30 days ago
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    queries.push({
      frequencyType: 'monthly',
      dateLastRan: { $lt: monthAgo },
    });

    return queries;
  }

  /**
   * Manual trigger for testing purposes
   */
  public static async triggerManualReportGeneration(searchPreferenceId?: string): Promise<void> {
    console.info('[ReportScheduler] Manual report generation triggered');

    try {
      if (searchPreferenceId) {
        // Generate report for specific preference
        const preference = await SearchPreferences.findById(searchPreferenceId);
        if (!preference) {
          throw new Error(`Search preference not found: ${searchPreferenceId}`);
        }

        await SchedulerHandler.generateReport(preference);
        console.info(`[ReportScheduler] Manual report generated for preference: ${searchPreferenceId}`);
      } else {
        // Generate reports for all due preferences
        await ReportSchedulerCron.processDailyReports();
      }
    } catch (error) {
      console.error('[ReportScheduler] Error in manual report generation:', error);
      throw error;
    }
  }

  /**
   * Get status of the cron job
   */
  public static getStatus(): { isRunning: boolean; nextRun?: Date, successCount: number; errorCount: number } {
    // Get next scheduled run time (midnight)
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(0, 0, 0, 0);

    return {
      isRunning: ReportSchedulerCron.isRunning,
      successCount: ReportSchedulerCron.successCount,
      errorCount: ReportSchedulerCron.errorCount,
      nextRun,
    };
  }
}
