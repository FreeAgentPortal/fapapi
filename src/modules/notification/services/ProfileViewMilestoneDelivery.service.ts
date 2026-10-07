import { randomUUID } from 'crypto';
import User from '../../auth/model/User';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { ProfessionalProfileModel } from '../../profiles/professional/model/ProfessionalProfile';
import logger from '../../../utils/logger';
import { EmailService } from '../email/EmailService';
import { buildProfileViewMilestoneEmail, buildProfileViewMilestoneSMS } from '../email/templates/profileViewMilestoneEmail';
import { ProfileViewDeliveryChannel, ProfileViewMilestoneDeliveryModel as Delivery } from '../model/ProfileViewMilestoneDelivery';
import { SMSService } from '../sms/SMSService';
import { easternDay, highestProfileViewMilestone, ProfileViewPeriod } from '../utils/profileViewMilestones';
import type { ProfileViewMilestoneCandidate } from './ProfileViewMilestone.service';

const LEASE_MS = 15 * 60 * 1000;
export type ProfileViewDeliveryOutcome = 'eligible' | 'sent' | 'skipped' | 'failed';
export interface ProfileViewDeliveryResult {
  outcome: ProfileViewDeliveryOutcome;
  eligible: boolean;
}

export class ProfileViewMilestoneDeliveryService {
  static async process(
    candidate: ProfileViewMilestoneCandidate,
    periods: ProfileViewPeriod[],
    channel: ProfileViewDeliveryChannel,
    now: Date,
    dryRun: boolean
  ): Promise<ProfileViewDeliveryResult> {
    const { subjectType, subjectProfileId } = candidate._id;
    // Deliberately excludes month and owner: month-end and current-month sends
    // share a daily limit, including when ownership changes.
    const gateId = `gate:${subjectType}:${subjectProfileId}:${channel}`;
    const day = easternDay(now);
    const lockToken = randomUUID();
    let claimed = false;
    let eligible = false;
    let deliveryId: string | undefined;
    try {
      if (dryRun) {
        const gate = await Delivery.findById(gateId).lean();
        if (gate?.lastAttemptDay === day || (gate?.lockedUntil && gate.lockedUntil > now)) return { outcome: 'skipped', eligible: false };
      } else {
        try {
          await Delivery.findOneAndUpdate(
            {
              _id: gateId,
              lastAttemptDay: { $ne: day },
              $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: new Date() } }],
            },
            {
              $set: { kind: 'gate', subjectType, subjectProfileId, channel, lockToken, lockedUntil: new Date(Date.now() + LEASE_MS) },
            },
            { upsert: true, new: true }
          );
          claimed = true;
        } catch (err) {
          if ((err as { code?: number }).code === 11000) return { outcome: 'skipped', eligible: false };
          throw err;
        }
      }

      const recipient = await this.recipient(candidate, channel);
      if (!recipient) return { outcome: 'skipped', eligible: false };

      // Each worker makes the previous/current-month choice under the same gate.
      // This prevents current-month sends from overtaking a pending closing alert.
      for (const period of periods) {
        const viewCount = candidate.counts.find((entry) => entry.month === period.key)?.count ?? 0;
        const milestone = highestProfileViewMilestone(viewCount);
        if (!milestone) continue;
        const key = `delivery:${recipient.userId}:${subjectType}:${subjectProfileId}:${period.key}:${channel}`;
        const progress = await Delivery.findById(key).lean();
        if ((progress?.highestDeliveredMilestone ?? 0) >= milestone) continue;
        if (dryRun) return { outcome: 'eligible', eligible: true };

        // Resolve again immediately before sending; ownership and consent can
        // change after aggregation or while another channel is being delivered.
        const currentRecipient = await this.recipient(candidate, channel);
        if (!currentRecipient || currentRecipient.userId !== recipient.userId) return { outcome: 'skipped', eligible: false };
        const attemptAt = new Date();
        if (easternDay(attemptAt) !== day) return { outcome: 'skipped', eligible: false };
        const reserved = await Delivery.updateOne(
          { _id: gateId, lockToken, lockedUntil: { $gt: attemptAt } },
          { $set: { lastAttemptDay: day, lastAttemptAt: attemptAt } }
        );
        if (!reserved.matchedCount) return { outcome: 'skipped', eligible: false };

        eligible = true;
        deliveryId = key;
        await Delivery.updateOne(
          { _id: key },
          {
            $setOnInsert: { kind: 'delivery', ownerUserId: recipient.userId, subjectType, subjectProfileId, month: period.key, channel },
            $set: { lastAttemptAt: attemptAt, lastAttemptDay: day, lockToken, lockedUntil: new Date(attemptAt.getTime() + LEASE_MS) },
          },
          { upsert: true }
        );
        const messageData = { name: currentRecipient.name, subjectType, monthLabel: period.label, viewCount };
        if (channel === 'email') {
          await EmailService.sendEmail({ to: currentRecipient.to, ...buildProfileViewMilestoneEmail(messageData) });
        } else {
          await SMSService.sendSMS({ to: currentRecipient.to, message: buildProfileViewMilestoneSMS(messageData) });
        }
        const saved = await Delivery.updateOne(
          { _id: key, lockToken },
          {
            $max: { highestDeliveredMilestone: milestone },
            $set: { lastSentAt: new Date() },
            $unset: { failedAt: 1, lockToken: 1, lockedUntil: 1 },
          }
        );
        if (!saved.matchedCount) throw new Error('Milestone delivery claim was lost after provider acceptance');
        return { outcome: 'sent', eligible: true };
      }
      return { outcome: 'skipped', eligible: false };
    } catch (err) {
      logger.error({ err, subjectType, subjectProfileId, channel, deliveryId, dryRun }, '[ProfileViewMilestones] Delivery failed; retry only during its month or closing run.');
      if (deliveryId) {
        try {
          await Delivery.updateOne(
            { _id: deliveryId, lockToken },
            { $set: { failedAt: new Date() }, $unset: { lockToken: 1, lockedUntil: 1 } }
          );
        } catch (persistenceError) {
          logger.error({ err: persistenceError, deliveryId }, '[ProfileViewMilestones] Could not persist delivery failure.');
        }
      }
      return { outcome: 'failed', eligible };
    } finally {
      if (claimed) {
        try {
          await Delivery.updateOne({ _id: gateId, lockToken }, { $unset: { lockToken: 1, lockedUntil: 1 } });
        } catch (err) {
          logger.error({ err, gateId }, '[ProfileViewMilestones] Could not release claim; lease will expire.');
        }
      }
    }
  }

  private static async recipient(candidate: ProfileViewMilestoneCandidate, channel: ProfileViewDeliveryChannel) {
    const query = { _id: candidate._id.subjectProfileId, isActive: { $ne: false } };
    const owner = candidate._id.subjectType === 'athlete'
      ? (await AthleteModel.findOne(query).select('userId').lean())?.userId
      : (await ProfessionalProfileModel.findOne(query).select('user').lean())?.user;
    if (!owner) return null;
    const user = await User.findOne({ _id: owner, isActive: { $ne: false } })
      .select('_id firstName fullName email phoneNumber notificationSettings').lean();
    if (!user) return null;
    let to: string;
    if (channel === 'email') {
      if (!user.email || user.notificationSettings?.accountNotificationEmail === false) return null;
      to = user.email;
    } else {
      if (user.notificationSettings?.accountNotificationSMS !== true || !user.phoneNumber) return null;
      try {
        to = SMSService.formatPhoneNumber(user.phoneNumber);
      } catch {
        logger.warn({ userId: user._id }, '[ProfileViewMilestones] Skipping invalid SMS phone number.');
        return null;
      }
    }
    return { userId: String(user._id), name: user.firstName || user.fullName || 'there', to };
  }
}
