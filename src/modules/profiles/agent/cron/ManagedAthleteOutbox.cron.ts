import cron from 'node-cron';
import { ManagedAthleteOutboxService } from '../managedAthlete/ManagedAthleteOutbox.service';

export class ManagedAthleteOutboxCron {
  private static isRunning = false;

  static init(): void {
    cron.schedule(
      '* * * * *',
      async () => {
        if (this.isRunning) {
          return;
        }
        this.isRunning = true;
        try {
          const result = await ManagedAthleteOutboxService.dispatchPending();
          if (result.attempted > 0) {
            console.info(
              `[ManagedAthleteOutbox] Published ${result.published} of ${result.attempted} pending event(s).`
            );
          }
        } catch (error) {
          console.error('[ManagedAthleteOutbox] Scheduled dispatch failed:', error);
        } finally {
          this.isRunning = false;
        }
      },
      {
        timezone: 'America/New_York',
        name: 'managed-athlete-outbox',
      }
    );
  }
}
