import mongoose from 'mongoose';
import { ProfileViewModel } from '../../profiles/analytics/model/ProfileViewModel';
import type { ProfileSubjectType } from '../../profiles/analytics/types';
import { ProfileViewMilestoneDeliveryModel } from '../model/ProfileViewMilestoneDelivery';
import { PROFILE_VIEW_TIMEZONE, ProfileViewPeriod, profileViewPeriods } from '../utils/profileViewMilestones';

export interface ProfileViewMilestoneOptions {
  /** Defaults to true. Set false explicitly to persist state and deliver messages. */
  dryRun?: boolean;
  subjectProfileId?: string;
  subjectType?: ProfileSubjectType;
}

export interface ProfileViewMilestoneCandidate {
  _id: { subjectType: ProfileSubjectType; subjectProfileId: mongoose.Types.ObjectId };
  counts: Array<{ month: string; count: number }>;
}

export class ProfileViewMilestoneService {
  static async getPeriods(now: Date, dryRun: boolean): Promise<ProfileViewPeriod[]> {
    let launch = await ProfileViewMilestoneDeliveryModel.findById('launch').lean();
    if (!launch && !dryRun) {
      try {
        launch = await ProfileViewMilestoneDeliveryModel.findOneAndUpdate(
          { _id: 'launch' },
          { $setOnInsert: { kind: 'launch', launchedAt: now } },
          { upsert: true, new: true }
        ).lean();
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
        launch = await ProfileViewMilestoneDeliveryModel.findById('launch').lean();
        if (!launch) throw err;
      }
    }
    return profileViewPeriods(now, launch?.launchedAt ?? now);
  }

  static validateOptions(options: ProfileViewMilestoneOptions): void {
    if (options.subjectProfileId && !mongoose.isValidObjectId(options.subjectProfileId)) {
      throw new Error('Invalid profile ID for milestone alerts');
    }
    if (options.subjectType && !['athlete', 'professional'].includes(options.subjectType)) {
      throw new Error('Milestone alerts support athlete and professional profiles only');
    }
  }

  static candidates(now: Date, periods: ProfileViewPeriod[], options: ProfileViewMilestoneOptions) {
    return ProfileViewModel.aggregate<ProfileViewMilestoneCandidate>([
      {
        $match: {
          createdAt: { $gte: periods[0].start, $lt: now },
          viewerType: { $in: ['team', 'scout', 'agent'] },
          subjectType: options.subjectType ?? { $in: ['athlete', 'professional'] },
          ...(options.subjectProfileId ? { subjectProfileId: new mongoose.Types.ObjectId(options.subjectProfileId) } : {}),
        },
      },
      {
        $group: {
          _id: {
            subjectType: '$subjectType',
            subjectProfileId: '$subjectProfileId',
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: PROFILE_VIEW_TIMEZONE } },
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { subjectType: '$_id.subjectType', subjectProfileId: '$_id.subjectProfileId' },
          counts: { $push: { month: '$_id.month', count: '$count' } },
        },
      },
    ]).allowDiskUse(true).cursor({ batchSize: 100 });
  }
}
