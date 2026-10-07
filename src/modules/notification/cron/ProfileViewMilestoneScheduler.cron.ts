import cron from 'node-cron';
import logger from '../../../utils/logger';
import { ProfileViewMilestoneHandler } from '../handler/ProfileViewMilestone.handler';
import type { ProfileViewMilestoneOptions } from '../services/ProfileViewMilestone.service';
import { PROFILE_VIEW_TIMEZONE } from '../utils/profileViewMilestones';

export class ProfileViewMilestoneScheduler {
  private static isRunning = false;
  private static initialized = false;

  static init(): void {
    if (this.initialized) return;
    cron.schedule('0 9 * * *', async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await ProfileViewMilestoneHandler.process({ dryRun: false });
      } catch (err) {
        logger.error({ err }, '[ProfileViewMilestones] Scheduled run failed.');
      } finally {
        this.isRunning = false;
      }
    }, { timezone: PROFILE_VIEW_TIMEZONE, name: 'profile-view-milestones' });
    this.initialized = true;
  }

  /** Internal entrypoint; defaults to a read-only preview. Requires an existing DB connection. */
  static triggerManualAlerts(options: ProfileViewMilestoneOptions = {}) {
    return ProfileViewMilestoneHandler.process(options);
  }
}
