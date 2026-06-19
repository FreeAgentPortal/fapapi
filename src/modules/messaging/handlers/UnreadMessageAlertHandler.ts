import mongoose from 'mongoose';
import { MessageModel } from '../models/Message';
import { ConversationModel } from '../models/Conversation';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { AgentProfileModel } from '../../profiles/agent/model/AgentProfile';
import TeamModel from '../../profiles/team/model/TeamModel';
import { EmailService } from '../../notification/email/EmailService';
import { SMSService } from '../../notification/sms/SMSService';
import Notification from '../../notification/model/Notification';
import User from '../../auth/model/User';

export class UnreadMessageAlertHandler {
  /**
   * Process unread message alerts for messages older than 2 hours
   * Only alerts athletes (teams don't have SMS consent yet)
   */
  static async processUnreadMessageAlerts(): Promise<{
    processed: number;
    emailsSent: number;
    smsSent: number;
    errors: number;
  }> {
    console.info('[UnreadMessageAlert] Starting unread message alert processing...');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    let processed = 0;
    let emailsSent = 0;
    let smsSent = 0;
    let errors = 0;

    try {
      // Find unread messages older than 2 hours where receiver is an athlete or agent
      const unreadMessages = await MessageModel.find({
        read: false,
        status: 'active',
        createdAt: { $lte: twoHoursAgo },
        'receiver.role': { $in: ['athlete', 'agent'] },
      })
        .populate('conversation')
        .lean();

      console.info(`[UnreadMessageAlert] Found ${unreadMessages.length} unread messages older than 2 hours`);

      for (const message of unreadMessages) {
        try {
          processed++;

          const [recipient, team] = await Promise.all([this.resolveRecipient(message.receiver.role, message.receiver.profile), TeamModel.findById(message.sender.profile).lean()]);

          if (!recipient || !team) {
            console.warn(`[UnreadMessageAlert] Recipient or Team not found for message ${message._id}`);
            errors++;
            continue;
          }

          const shouldAlert = await this.shouldSendMessageAlert(recipient, message);
          if (!shouldAlert) {
            continue;
          }

          const [notificationResult, emailResult, smsResult] = await Promise.allSettled([
            this.insertUnreadMessageNotification(recipient, team, message),
            this.sendUnreadMessageEmail(recipient, team, message),
            this.sendUnreadMessageSMS(recipient, team, message),
          ]);

          if (notificationResult.status === 'rejected') {
            console.error(`[UnreadMessageAlert] Failed to insert notification for message ${message._id}`);
          }
          if (emailResult.status === 'fulfilled' && emailResult.value) {
            emailsSent++;
          }
          if (smsResult.status === 'fulfilled' && smsResult.value) {
            smsSent++;
          }

          if (notificationResult.status === 'rejected' || emailResult.status === 'rejected' || smsResult.status === 'rejected') {
            errors++;
          }
        } catch (error) {
          console.error(`[UnreadMessageAlert] Error processing message ${message._id}:`, error);
          errors++;
        }
      }

      console.info('[UnreadMessageAlert] Unread message alert processing completed:', {
        processed,
        emailsSent,
        smsSent,
        errors,
      });

      return { processed, emailsSent, smsSent, errors };
    } catch (error) {
      console.error('[UnreadMessageAlert] Fatal error in unread message alert processing:', error);
      throw error;
    }
  }

  /**
   * Check if we should send an alert for this specific message
   * (to avoid spamming - only alert once per day per message)
   * @param recipient - The recipient profile wrapper
   * @param message - The unread message
   * @returns boolean indicating if alert should be sent
   */
  private static async shouldSendMessageAlert(recipient: any, message: any): Promise<boolean> {
    try {
      const recentAlert = await Notification.findOne({
        userTo: recipient.user?._id,
        notificationType: 'message',
        entityId: message._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      return !recentAlert;
    } catch (error) {
      console.warn(`[UnreadMessageAlert] Error checking recent alerts for message ${message._id}:`, error);
      return true;
    }
  }

  /**
   * Insert in-app notification for unread message
   * @param recipient - The recipient profile wrapper
   * @param team - The team that sent the message
   * @param message - The unread message
   */
  private static async insertUnreadMessageNotification(recipient: any, team: any, message: any): Promise<boolean> {
    try {
      if (!recipient.user?._id) {
        console.warn(`[UnreadMessageAlert] No userId for recipient ${recipient.profile?._id}`);
        return false;
      }

      const messagePreview = message.content.length > 50 ? `${message.content.substring(0, 50)}...` : message.content;

      await Notification.insertNotification(
        recipient.user._id as any,
        null as any, // No specific sender for system notifications
        `New message from ${team.name}`,
        `${team.name} sent you a message: "${messagePreview}"`,
        'message',
        message._id as any
      );

      console.info(`[UnreadMessageAlert] Notification inserted for recipient ${recipient.profile?._id} for message ${message._id}`);
      return true;
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error inserting notification for message ${message._id}:`, error);
      throw error;
    }
  }

  /**
   * Send unread message email to recipient
   */
  private static async sendUnreadMessageEmail(recipient: any, team: any, message: any): Promise<boolean> {
    try {
      if (!recipient.email) {
        console.warn(`[UnreadMessageAlert] No email for recipient ${recipient.profile?._id}`);
        return false;
      }

      await EmailService.sendEmail({
        to: recipient.email,
        subject: `New message from ${team.name}`,
        templateId: 'd-2a603e8ef7434ffca83c795057f1d58f', // TODO: Replace with actual template ID
        data: {
          athleteName: recipient.name,
          teamName: team.name,
          teamLogo: team.logoUrl,
          messagePreview: message.content.substring(0, 100),
          messageUrl: `https://athlete.thefreeagentportal.com/messages/${message.conversation._id || message.conversation}`,
          supportEmail: 'support@freeagentportal.com',
          logoUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
          currentYear: new Date().getFullYear(),
          subject: `New message from ${team.name}`,
        },
      });

      console.info(`[UnreadMessageAlert] Email sent to ${recipient.email} for message ${message._id}`);
      return true;
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error sending email to ${recipient.email}:`, error);
      throw error;
    }
  }

  /**
   * Send unread message SMS to recipient
   * Only sends if the recipient has SMS notifications enabled
   */
  private static async sendUnreadMessageSMS(recipient: any, team: any, message: any): Promise<boolean> {
    try {
      if (!recipient.user) {
        console.warn(`[UnreadMessageAlert] Recipient ${recipient.profile?._id} does not have user populated`);
        return false;
      }

      const phoneNumber = recipient.user.phoneNumber || recipient.contactNumber;
      if (!phoneNumber) {
        console.warn(`[UnreadMessageAlert] No phone number for recipient ${recipient.profile?._id}`);
        return false;
      }

      if (!recipient.user.notificationSettings?.accountNotificationSMS) {
        console.info(`[UnreadMessageAlert] Recipient ${recipient.profile?._id} has SMS alerts disabled`);
        return false;
      }

      await SMSService.sendSMS({
        to: phoneNumber,
        data: {
          contentSid: 'HX762f1dc9c222adbc92383b2f53bdd222',
          contentVariables: {
            message: `You have a new message from ${team.name}: "${message.content.substring(0, 50)}..."
            login to your account to read and respond.
            `,
          },
        },
      });

      console.info(`[UnreadMessageAlert] SMS sent to ${phoneNumber} for message ${message._id}`);
      return true;
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error sending SMS to recipient ${recipient.profile?._id}:`, error);
      throw error;
    }
  }

  /**
   * Process alert for a specific message (for testing)
   */
  static async processSpecificMessageAlert(messageId: string): Promise<void> {
    console.info(`[UnreadMessageAlert] Processing alert for message: ${messageId}`);

    try {
      const message = await MessageModel.findById(messageId).populate('conversation').lean();

      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }

      if (message.read) {
        console.warn(`[UnreadMessageAlert] Message ${messageId} has already been read`);
        return;
      }

      if (!['athlete', 'agent'].includes(message.receiver.role)) {
        console.warn(`[UnreadMessageAlert] Message ${messageId} receiver is not an athlete or agent`);
        return;
      }

      const [recipient, team] = await Promise.all([this.resolveRecipient(message.receiver.role, message.receiver.profile), TeamModel.findById(message.sender.profile).lean()]);

      if (!recipient || !team) {
        throw new Error('Recipient or Team not found');
      }

      const shouldAlert = await this.shouldSendMessageAlert(recipient, message);
      if (!shouldAlert) {
        return;
      }

      await Promise.all([
        this.insertUnreadMessageNotification(recipient, team, message),
        this.sendUnreadMessageEmail(recipient, team, message),
        this.sendUnreadMessageSMS(recipient, team, message),
      ]);

      console.info(`[UnreadMessageAlert] Alert sent for message ${messageId}`);
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error processing specific message alert:`, error);
      throw error;
    }
  }

  private static async resolveRecipient(role: string, profileId: any): Promise<any | null> {
    if (role === 'athlete') {
      const athlete = await AthleteModel.findById(profileId).populate('userId').lean();
      if (!athlete) {
        return null;
      }
      return {
        profile: athlete,
        user: athlete.userId,
        name: athlete.fullName,
        email: athlete.email,
        contactNumber: athlete.contactNumber,
      };
    }

    if (role === 'agent') {
      const [profile, user] = await Promise.all([
        AgentProfileModel.findById(profileId).lean(),
        User.findOne({ 'profileRefs.agent': profileId }).lean(),
      ]);
      if (!profile) {
        return null;
      }
      return {
        profile,
        user,
        name: profile.displayName || profile.agencyName,
        email: profile.email || user?.email,
        contactNumber: profile.contactNumber,
      };
    }

    return null;
  }
}
