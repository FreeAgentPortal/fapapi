import cron from 'node-cron';
import { ReportSchedulerCron } from '../modules/search-preferences/cron/ReportScheduler.cron';
import SearchReportEventHandler from '../modules/notification/services/SearchReportEvent.service';

export const cronJobs = async () => {
  console.log('[CronJobs] Initializing cron jobs...');
  // Initialize the daily search report generation cron job
  ReportSchedulerCron.init();
  console.log('[CronJobs] All cron jobs initialized successfully');
};
