import { ErrorUtil } from '../../../middleware/ErrorUtil';
import Notification from '../model/Notification';
import { IMessage } from '../../messaging/models/Message';
import User from '../../auth/model/User';
import { EmailService } from '../email/EmailService';
import { SMSService } from '../sms/SMSService';
import { IConversation } from '../../messaging/models/Conversation';
import TeamModel from '../../profiles/team/model/TeamModel';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';

export default class ConversationEventHandler {
  async messageSent(event: { message: IMessage }) {
    console.info(`[Notification] Message: ${event.message.id} sent`);
    const { message } = event;
    if (!message) {
      throw new ErrorUtil('message data is required for conversation event handling', 400);
    }

    //Find the user based on the profileID and if the role is team or athlete
    let receiverUser;
    let senderUser;
    if (message.sender.role === 'team') {
      senderUser = await User.findOne({ 'profileRefs.athlete': message.sender.profile });
    } else {
      senderUser = await User.findOne({ 'profileRefs.team': message.sender.profile });
    }

    if (message.receiver.role === 'team') {
      receiverUser = await User.findOne({ 'profileRefs.athlete': message.receiver.profile });
    } else {
      receiverUser = await User.findOne({ 'profileRefs.team': message.receiver.profile });
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
      const athlete = await AthleteModel.findById(conversation.participants.athlete).populate('userId');

      if (!team || !athlete) {
        throw new ErrorUtil('Team or Athlete not found', 404);
      }

      // Send email and SMS notifications in parallel (athlete only)
      await Promise.all([this.sendConversationStartedEmail(athlete, team), this.sendConversationStartedSMS(athlete, team)]);
    } catch (error) {
      console.error('Error sending conversation started notifications', error);
    }
  }

  /**
   * Send conversation started email to athlete
   */
  private async sendConversationStartedEmail(athlete: any, team: any): Promise<void> {
    try {
      await EmailService.sendEmail({
        to: athlete?.email || '',
        subject: 'Your conversation with the ' + team?.name + ' has started',
        templateId: 'd-5cd1271c64db486e8b7f3521cb98f75d',
        data: {
          athleteName: athlete?.fullName,
          teamName: team?.name,
          teamLogo: team?.logoUrl,
          supportEmail: 'support@freeagentportal.com',
          logoUrl: 'https://res.cloudinary.com/dsltlng97/image/upload/v1752863629/placeholder-logo_s7jg3y.png',
          currentYear: new Date().getFullYear(),
          subject: 'Your conversation with the ' + team?.name + ' has started',
        },
      });
      console.info(`[Notification]: Conversation started email sent to ${athlete?.email}`);
    } catch (error) {
      console.error(`[Notification]: Error sending conversation started email to ${athlete?.email}:`, error);
    }
  }

  /**
   * Send conversation started SMS to athlete
   * Only sends if athlete has SMS notifications enabled
   */
  private async sendConversationStartedSMS(athlete: any, team: any): Promise<void> {
    try {
      // Check if athlete has a userId populated
      if (!athlete.userId) {
        console.warn(`[Notification]: Athlete ${athlete._id} does not have userId populated, skipping SMS notification`);
        return;
      }

      // Check if phone number is provided
      const phoneNumber = athlete.userId.phoneNumber || athlete.contactNumber;
      if (!phoneNumber) {
        console.warn(`[Notification]: No phone number available for athlete ${athlete._id}, skipping SMS notification`);
        return;
      }

      // Check SMS notification preferences
      if (!athlete.userId.notificationSettings?.accountNotificationSMS) {
        console.info(`[Notification]: Athlete ${athlete._id} has SMS alerts disabled, skipping SMS notification`);
        return;
      }

      // Send the SMS
      await SMSService.sendSMS({
        to: phoneNumber,
        data: {
          contentSid: 'HX762f1dc9c222adbc92383b2f53bdd222',
          contentVariables: {
            message: `Good news ${athlete?.fullName}! Someone from the ${team?.name} has started a conversation with you! 
            Log in to your account to check your messages and respond promptly.`,
          },
        },
      });
      console.info(`[Notification]: Conversation started SMS sent to ${phoneNumber}`);
    } catch (error) {
      console.error(`[Notification]: Error sending conversation started SMS:`, error);
    }
  }
}
