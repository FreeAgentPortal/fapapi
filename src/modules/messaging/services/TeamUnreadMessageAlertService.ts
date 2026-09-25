import { randomUUID } from 'crypto';
import User from '../../auth/model/User';
import { EmailService } from '../../notification/email/EmailService';
import Notification from '../../notification/model/Notification';
import { AgentProfileModel } from '../../profiles/agent/model/AgentProfile';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import TeamModel from '../../profiles/team/model/TeamModel';
import { IConversation } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { TeamMessageReminderModel } from '../models/TeamMessageReminder';
import { buildTeamUnreadMessageEmail } from '../utils/teamUnreadMessageEmail';

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DELIVERY_LEASE_MS = 15 * 60 * 1000;

export class TeamUnreadMessageAlertService {
  static async processMessage(messageId: string): Promise<{ emailsSent: number; errors: number }> {
    const result = { emailsSent: 0, errors: 0 };
    // Recheck eligibility in case the message was read after the scheduler queried it.
    const message = await MessageModel.findOne({
      _id: messageId,
      read: false,
      status: 'active',
      'receiver.role': 'team',
      'sender.role': { $in: ['athlete', 'agent'] },
    }).populate<{ conversation: IConversation | null }>('conversation').lean();

    const conversation = message?.conversation;
    if (!message || !conversation || conversation.status !== 'active') return result;
    if (String(conversation.participants.team) !== String(message.receiver.profile)) return result;

    const team = await TeamModel.findById(message.receiver.profile).lean();
    if (!team || team.isActive === false || team.alertsEnabled === false) return result;

    const linkedUserIds = (team.linkedUsers || []).map((member) => member.user?._id || member.user).filter(Boolean);
    const users = await User.find({
      isActive: { $ne: false },
      $or: [{ _id: { $in: linkedUserIds } }, { 'profileRefs.team': { $in: [team._id, String(team._id)] } }],
    }).lean();
    if (!users.length) {
      console.warn(`[TeamUnreadMessageAlert] No active team members for team ${team._id}`);
      return result;
    }

    let senderName: string;
    if (message.sender.role === 'agent') {
      const agent = await AgentProfileModel.findById(message.sender.profile).lean();
      senderName = agent?.displayName || agent?.agencyName || 'An athlete representative';
    } else {
      const athlete = await AthleteModel.findById(message.sender.profile).lean();
      senderName = athlete?.fullName || 'An athlete';
    }

    const messagePreview = message.content.length > 300 ? `${message.content.substring(0, 300)}...` : message.content;
    const email = buildTeamUnreadMessageEmail({ teamName: team.name, senderName, messagePreview, conversationId: String(conversation._id) });

    for (const user of users) {
      const reminderKey = `${conversation._id}:${user._id}`;
      const [notificationResult, emailResult] = await Promise.allSettled([
        this.deliverOncePerDay(`${reminderKey}:notification`, async () => {
          const notification = await Notification.insertNotification(
            user._id as any,
            null as any,
            `Unread message from ${senderName}`,
            `${senderName} sent ${team.name} a message. Open your team inbox to read and reply.`,
            'message',
            message._id as any
          );
          // The shared helper logs save failures and can return undefined.
          if (!notification) throw new Error('Failed to save team unread message notification');
        }),
        user.email && user.notificationSettings?.accountNotificationEmail !== false
          ? this.deliverOncePerDay(`${reminderKey}:email`, async () => {
              await EmailService.sendEmail({ to: user.email, ...email });
            })
          : Promise.resolve(false),
      ]);

      if (emailResult.status === 'fulfilled' && emailResult.value) result.emailsSent++;
      for (const delivery of [notificationResult, emailResult]) {
        if (delivery.status === 'rejected') {
          result.errors++;
          console.error(`[TeamUnreadMessageAlert] Reminder failed for message ${messageId}, user ${user._id}:`, delivery.reason);
        }
      }
    }

    return result;
  }

  private static async deliverOncePerDay(key: string, deliver: () => Promise<void>): Promise<boolean> {
    const now = new Date();
    const lockToken = randomUUID();
    try {
      // The deterministic _id makes this claim atomic across server workers, even
      // before any secondary indexes exist. A recent or in-flight record conflicts
      // with the upsert and produces duplicate-key error 11000, which means skip.
      await TeamMessageReminderModel.findOneAndUpdate(
        {
          _id: key,
          $and: [
            { $or: [{ lastSentAt: { $exists: false } }, { lastSentAt: { $lte: new Date(now.getTime() - REMINDER_INTERVAL_MS) } }] },
            { $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }] },
          ],
        },
        { $set: { lockToken, lockedUntil: new Date(now.getTime() + DELIVERY_LEASE_MS) } },
        { upsert: true, new: true }
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    }

    try {
      await deliver();
      await TeamMessageReminderModel.updateOne(
        { _id: key, lockToken },
        { $set: { lastSentAt: new Date() }, $unset: { lockToken: 1, lockedUntil: 1 } }
      );
      return true;
    } catch (error) {
      // Failed deliveries remain eligible on the next run. Email and in-app
      // delivery have independent records, so success on one cannot hide failure on the other.
      await TeamMessageReminderModel.updateOne({ _id: key, lockToken }, { $unset: { lockToken: 1, lockedUntil: 1 } });
      throw error;
    }
  }
}
