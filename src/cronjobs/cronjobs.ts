import { ReportSchedulerCron } from '../modules/search-preferences/cron/ReportScheduler.cron';

export const cronJobs = async () => {
  console.info('[CronJobs] Initializing cron jobs...');
  // only init if not in development mode
  if (process.env.NODE_ENV === 'development') {
    console.warn('[CronJobs] Skipping cron job initialization in development mode');
    return;
  }
  // Initialize the daily search report generation cron job
  ReportSchedulerCron.init();
  console.log('[CronJobs] All cron jobs initialized successfully');
};
