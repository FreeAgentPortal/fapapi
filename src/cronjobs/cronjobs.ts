import cron from 'node-cron';

export const cronJobs = async () => {
  cron.schedule(
    '0 0 * * *',
    async () => {
      console.log('Running a job at 00:00 at America/Los_Angeles timezone');
    },
    {
      timezone: 'America/Los_Angeles',
    }
  );
};
