import { ErrorUtil } from '../../../middleware/ErrorUtil';
import Notification from '../model/Notification';
import { IMessage } from '../../messaging/models/Message';
import User from '../../auth/model/User';
import { EmailService } from '../email/EmailService';
import { SMSService } from '../sms/SMSService';
import { IConversation } from '../../messaging/models/Conversation';
import TeamModel from '../../profiles/team/model/TeamModel';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';
import { AgentProfileModel } from '../../profiles/agent/model/AgentProfile';

export default class ConversationEventHandler {
  async messageSent(event: { message: IMessage }) {
    console.info(`[Notification] Message: ${event.message.id} sent`);
    const { message } = event;
    if (!message) {
      throw new ErrorUtil('message data is required for conversation event handling', 400);
    }

    const [senderUser, receiverUser] = await Promise.all([
      this.findUserByProfile(message.sender.role, message.sender.profile),
      this.findUserByProfile(message.receiver.role, message.receiver.profile),
    ]);

    if (!receiverUser) {
      return;
    }

    await Notification.insertNotification(receiverUser?.id, senderUser?.id, 'New message', 'You have a new message', 'message', message.id);
  }

  async conversationStarted(event: { conversation: IConversation }) {
    console.info(`[Notification] Conversation: ${event.conversation.id} started`);
    const { conversation } = event;
    if (!conversation) {
      throw new ErrorUtil('conversation data is required for conversation event handling', 400);
    }

    try {
      const team = await TeamModel.findById(conversation.participants.team);
      const recipient = await this.resolveConversationRecipient(conversation);

      if (!team || !recipient) {
        throw new ErrorUtil('Team or conversation recipient not found', 404);
      }

      await Promise.all([this.sendConversationStartedEmail(recipient.profile, team), this.sendConversationStartedSMS(recipient.profile, recipient.user, team)]);
    } catch (error) {
      console.error('Error sending conversation started notifications', error);
    }
  }

  /**
   * Send conversation started email to athlete
   */
  private async sendConversationStartedEmail(recipient: any, team: any): Promise<void> {
    try {
      await EmailService.sendEmail({
        to: recipient?.email || '',
        subject: 'Your conversation with the ' + team?.name + ' has started',
        templateId: 'd-5cd1271c64db486e8b7f3521cb98f75d',
        data: {
          athleteName: recipient?.fullName || recipient?.displayName || recipient?.agencyName,
          teamName: team?.name,
          teamLogo: team?.logoUrl,
          supportEmail: 'support@freeagentportal.com',
          logoUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
          currentYear: new Date().getFullYear(),
          subject: 'Your conversation with the ' + team?.name + ' has started',
        },
      });
      console.info(`[Notification]: Conversation started email sent to ${recipient?.email}`);
    } catch (error) {
      console.error(`[Notification]: Error sending conversation started email to ${recipient?.email}:`, error);
    }
  }

  /**
   * Send conversation started SMS to athlete
   * Only sends if athlete has SMS notifications enabled
   */
  private async sendConversationStartedSMS(recipientProfile: any, user: any, team: any): Promise<void> {
    try {
      if (!user) {
        console.warn(`[Notification]: No user found for conversation recipient ${recipientProfile?._id}, skipping SMS notification`);
        return;
      }

      const phoneNumber = user.phoneNumber || recipientProfile.contactNumber;
      if (!phoneNumber) {
        console.warn(`[Notification]: No phone number available for recipient ${recipientProfile?._id}, skipping SMS notification`);
        return;
      }

      if (!user.notificationSettings?.accountNotificationSMS) {
        console.info(`[Notification]: Recipient ${recipientProfile?._id} has SMS alerts disabled, skipping SMS notification`);
        return;
      }

      await SMSService.sendSMS({
        to: phoneNumber,
        data: {
          contentSid: 'HX762f1dc9c222adbc92383b2f53bdd222',
          contentVariables: {
            message: `Good news ${recipientProfile?.fullName || recipientProfile?.displayName || recipientProfile?.agencyName}! Someone from the ${team?.name} has started a conversation with you! 
            Log in to your account to check your messages and respond promptly.`,
          },
        },
      });
      console.info(`[Notification]: Conversation started SMS sent to ${phoneNumber}`);
    } catch (error) {
      console.error(`[Notification]: Error sending conversation started SMS:`, error);
    }
  }

  private async findUserByProfile(role: 'team' | 'athlete' | 'agent', profileId: any) {
    return await User.findOne({ [`profileRefs.${role}`]: profileId });
  }

  private async resolveConversationRecipient(conversation: IConversation): Promise<{ profile: any; user: any } | null> {
    if (conversation.participants.agent) {
      const [profile, user] = await Promise.all([
        AgentProfileModel.findById(conversation.participants.agent).lean(),
        User.findOne({ 'profileRefs.agent': conversation.participants.agent }).lean(),
      ]);
      if (!profile) {
        return null;
      }
      return { profile, user };
    }

    const athlete = await AthleteModel.findById(conversation.participants.athlete).populate('userId');
    if (!athlete) {
      return null;
    }
    return { profile: athlete, user: athlete.userId };
  }
}
