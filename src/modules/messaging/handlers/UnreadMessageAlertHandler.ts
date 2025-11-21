import mongoose from 'mongoose';
import { MessageModel } from '../models/Message';
import { ConversationModel } from '../models/Conversation';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import TeamModel from '../../profiles/team/model/TeamModel';
import { EmailService } from '../../notification/email/EmailService';
import { SMSService } from '../../notification/sms/SMSService';

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

          // Send email and SMS in parallel
          const [emailResult, smsResult] = await Promise.allSettled([this.sendUnreadMessageEmail(athlete, team, message), this.sendUnreadMessageSMS(athlete, team, message)]);

          if (emailResult.status === 'fulfilled' && emailResult.value) {
            emailsSent++;
          }
          if (smsResult.status === 'fulfilled' && smsResult.value) {
            smsSent++;
          }

          if (emailResult.status === 'rejected' || smsResult.status === 'rejected') {
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
        templateId: 'd-8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f', // TODO: Replace with actual template ID
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
          contentSid: 'HXb1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6', // TODO: Replace with actual Twilio template ID
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

      await Promise.all([this.sendUnreadMessageEmail(athlete, team, message), this.sendUnreadMessageSMS(athlete, team, message)]);

      console.info(`[UnreadMessageAlert] Alert sent for message ${messageId}`);
    } catch (error) {
      console.error(`[UnreadMessageAlert] Error processing specific message alert:`, error);
      throw error;
    }
  }
}
