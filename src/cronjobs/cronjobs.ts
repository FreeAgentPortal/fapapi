import { ReportSchedulerCron } from '../modules/search-preferences/cron/ReportScheduler.cron';
import { AthleteSchedulerCron } from '../modules/profiles/cron/AthleteScheduler.cron';
import { PaymentSchedulerCron } from '../modules/payment/cron/PaymentScheduler.cron';
import { EventSchedulerCron } from '../modules/feed/cron/EventScheduler.cron';

export const cronJobs = async () => { EventSchedulerCron.init();
  // only init if not in development mode
  if (process.env.NODE_ENV === 'development') {
    console.warn('[CronJobs] Skipping cron job initialization in development mode');
    return;
  }
  console.info('[CronJobs] Initializing cron jobs...');
  // Initialize the daily search report generation cron job
  ReportSchedulerCron.init();

  // Initialize the athlete profile completion reminder cron job
  AthleteSchedulerCron.init();

  // Initialize the payment processing cron job
  PaymentSchedulerCron.init();

 
  console.info('[CronJobs] All cron jobs initialized successfully');
};
