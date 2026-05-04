import mongoose from 'mongoose';
import { MessageModel } from '../models/Message';
import { ConversationModel } from '../models/Conversation';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import TeamModel from '../../profiles/team/model/TeamModel';
import { EmailService } from '../../notification/email/EmailService';
import { SMSService } from '../../notification/sms/SMSService';
import Notification from '../../notification/model/Notification';

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
      // Find unread messages older than 2 hours where receiver is an athlete
      const unreadMessages = await MessageModel.find({
        read: false,
        status: 'active',
        createdAt: { $lte: twoHoursAgo },
        'receiver.role': 'athlete', // Only alert athletes
      })
        .populate('conversation')
        .lean();

      console.info(`[UnreadMessageAlert] Found ${unreadMessages.length} unread messages older than 2 hours`);

      for (const message of unreadMessages) {
        try {
          processed++;

          // Get athlete and team details
          const [athlete, team] = await Promise.all([AthleteModel.findById(message.receiver.profile).populate('userId').lean(), TeamModel.findById(message.sender.profile).lean()]);

          if (!athlete || !team) {
            console.warn(`[UnreadMessageAlert] Athlete or Team not found for message ${message._id}`);
            errors++;
            continue;
          }

          // Check if we should send alert for this message (not already sent today)
          const shouldAlert = await this.shouldSendMessageAlert(athlete, message);
          if (!shouldAlert) {
            // console.info(`[UnreadMessageAlert] Alert already sent for message ${message._id} within last 24 hours, skipping`);
            continue;
          }

          // Send notification insert, email and SMS in parallel
          const [notificationResult, emailResult, smsResult] = await Promise.allSettled([
            this.insertUnreadMessageNotification(athlete, team, message),
            this.sendUnreadMessageEmail(athlete, team, message),
            this.sendUnreadMessageSMS(athlete, team, message),
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
   * @param athlete - The athlete profile
   * @param message - The unread message
   * @returns boolean indicating if alert should be sent
   */
  private static async shouldSendMessageAlert(athlete: any, message: any): Promise<boolean> {
    try {
      // Check if we've sent an alert for this specific message in the last 24 hours
      const recentAlert = await Notification.findOne({
        userTo: athlete.userId,
        notificationType: 'message',
        entityId: message._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      return !recentAlert;
    } catch (error) {
      console.warn(`[UnreadMessageAlert] Error checking recent alerts for message ${message._id}:`, error);
      // If we can't check, err on the side of sending the alert
      return true;
    }
  }

  /**
   * Insert in-app notification for unread message
   * @param athlete - The athlete profile
   * @param team - The team that sent the message
   * @param message - The unread message
   */
  private static async insertUnreadMessageNotification(athlete: any, team: any, message: any): Promise<boolean> {
    try {
      if (!athlete.userId) {
        console.warn(`[UnreadMessageAlert] No userId for athlete ${athlete._id}`);
        return false;
      }

      const messagePreview = message.content.length > 50 ? `${message.content.substring(0, 50)}...` : message.content;

      await Notification.insertNotification(
        athlete.userId as any,
        null as any, // No specific sender for system notifications
        `New message from ${team.name}`,
        `${team.name} sent you a message: "${messagePreview}"`,
        'message',
        message._id as any
      );

      console.info(`[UnreadMessageAlert] Notification inserted for athlete ${athlete._id} for message ${message._id}`);
      return true;
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error inserting notification for message ${message._id}:`, error);
      throw error;
    }
  }

  /**
   * Send unread message email to athlete
   */
  private static async sendUnreadMessageEmail(athlete: any, team: any, message: any): Promise<boolean> {
    try {
      if (!athlete.email) {
        console.warn(`[UnreadMessageAlert] No email for athlete ${athlete._id}`);
        return false;
      }

      await EmailService.sendEmail({
        to: athlete.email,
        subject: `New message from ${team.name}`,
        templateId: 'd-2a603e8ef7434ffca83c795057f1d58f', // TODO: Replace with actual template ID
        data: {
          athleteName: athlete.fullName,
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

      console.info(`[UnreadMessageAlert] Email sent to ${athlete.email} for message ${message._id}`);
      return true;
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error sending email to ${athlete.email}:`, error);
      throw error;
    }
  }

  /**
   * Send unread message SMS to athlete
   * Only sends if athlete has SMS notifications enabled
   */
  private static async sendUnreadMessageSMS(athlete: any, team: any, message: any): Promise<boolean> {
    try {
      // Check if athlete has userId populated
      if (!athlete.userId) {
        console.warn(`[UnreadMessageAlert] Athlete ${athlete._id} does not have userId populated`);
        return false;
      }

      // Check if phone number is provided
      const phoneNumber = athlete.userId.phoneNumber || athlete.contactNumber;
      if (!phoneNumber) {
        console.warn(`[UnreadMessageAlert] No phone number for athlete ${athlete._id}`);
        return false;
      }

      // Check SMS notification preferences
      if (!athlete.userId.notificationSettings?.accountNotificationSMS) {
        console.info(`[UnreadMessageAlert] Athlete ${athlete._id} has SMS alerts disabled`);
        return false;
      }

      // Send the SMS
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
      console.error(`[UnreadMessageAlert] Error sending SMS to athlete ${athlete._id}:`, error);
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

      if (message.receiver.role !== 'athlete') {
        console.warn(`[UnreadMessageAlert] Message ${messageId} receiver is not an athlete`);
        return;
      }

      const [athlete, team] = await Promise.all([AthleteModel.findById(message.receiver.profile).populate('userId').lean(), TeamModel.findById(message.sender.profile).lean()]);

      if (!athlete || !team) {
        throw new Error('Athlete or Team not found');
      }

      // Check if we should send alert
      const shouldAlert = await this.shouldSendMessageAlert(athlete, message);
      if (!shouldAlert) {
        // console.info(`[UnreadMessageAlert] Alert already sent for message ${messageId} within last 24 hours, skipping`);
        return;
      }

      await Promise.all([
        this.insertUnreadMessageNotification(athlete, team, message),
        this.sendUnreadMessageEmail(athlete, team, message),
        this.sendUnreadMessageSMS(athlete, team, message),
      ]);

      console.info(`[UnreadMessageAlert] Alert sent for message ${messageId}`);
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error processing specific message alert:`, error);
      throw error;
    }
  }
}
