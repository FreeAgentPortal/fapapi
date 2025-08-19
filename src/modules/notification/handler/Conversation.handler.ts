import { ErrorUtil } from '../../../middleware/ErrorUtil';
import Notification from '../model/Notification';
import { IMessage } from '../../messaging/models/Message';
import User from '../../auth/model/User';
import { EmailService } from '../email/EmailService';
import { IConversation } from '../../messaging/models/Conversation';
import TeamModel from '../../profiles/team/model/TeamModel';
import { AthleteModel } from '../../profiles/athlete/models/AthleteModel';

export default class ConversationEventHandler {
  async messageSent(event: { message: IMessage }) {
    console.log(`[Notification] Message: ${event.message.id} sent`);
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
    console.log(`[Notification] Conversation: ${event.conversation.id} started`);
    const { conversation } = event;
    if (!conversation) {
      throw new ErrorUtil('conversation data is required for conversation event handling', 400);
    }

    try {
      const team = await TeamModel.findById(conversation.participants.team);
      const athlete = await AthleteModel.findById(conversation.participants.athlete);

      if (!team || !athlete) {
        throw new ErrorUtil('Team or Athlete not found', 404);
      }

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
    } catch (error) {
      console.log('Error sending email', error);
    }
  }
}
