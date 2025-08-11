import { ErrorUtil } from '../../../middleware/ErrorUtil';
import Notification from '../model/Notification';
import { IMessage } from '../../messaging/models/Message';
import User from '../../auth/model/User';

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
}
