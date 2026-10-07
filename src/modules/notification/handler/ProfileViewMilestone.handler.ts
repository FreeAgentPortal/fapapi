import logger from '../../../utils/logger';
import { ProfileViewMilestoneOptions, ProfileViewMilestoneService } from '../services/ProfileViewMilestone.service';
import { ProfileViewMilestoneDeliveryService } from '../services/ProfileViewMilestoneDelivery.service';

export interface ProfileViewMilestoneResult {
  dryRun: boolean;
  profiles: number;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
}

export class ProfileViewMilestoneHandler {
  static async process(options: ProfileViewMilestoneOptions = {}): Promise<ProfileViewMilestoneResult> {
    ProfileViewMilestoneService.validateOptions(options);
    const now = new Date();
    const dryRun = options.dryRun !== false;
    const result: ProfileViewMilestoneResult = { dryRun, profiles: 0, eligible: 0, sent: 0, skipped: 0, failed: 0 };
    const periods = await ProfileViewMilestoneService.getPeriods(now, dryRun);
    const cursor = ProfileViewMilestoneService.candidates(now, periods, options);
    try {
      // A cursor bounds database batches; only this profile's two channels run concurrently.
      for await (const candidate of cursor) {
        result.profiles++;
        const outcomes = await Promise.all([
          ProfileViewMilestoneDeliveryService.process(candidate, periods, 'email', now, dryRun),
          ProfileViewMilestoneDeliveryService.process(candidate, periods, 'sms', now, dryRun),
        ]);
        for (const { outcome, eligible } of outcomes) {
          if (eligible) result.eligible++;
          if (outcome !== 'eligible') result[outcome]++;
        }
      }
    } finally {
      await cursor.close();
      logger.info({ ...result, months: periods.map((period) => period.key) }, '[ProfileViewMilestones] Run summary');
    }
    return result;
  }
}
