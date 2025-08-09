import { ErrorUtil } from '../../../middleware/ErrorUtil';
import Notification from '../model/Notification';
import { IMessage } from '../../messaging/models/Message';

export default class ConversationEventHandler {
  async messageSent(event: { message: IMessage }) {
    console.log(`[Notification] Message: ${event.message.id} sent`);
    const { message } = event;
    if (!message) {
      throw new ErrorUtil('message data is required for conversation event handling', 400);
    }
    await Notification.insertNotification(message.receiver.user, message.sender.user, 'New message', 'You have a new message', 'message', message.id);
  }
}
