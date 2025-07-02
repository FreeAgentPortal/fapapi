import { ErrorUtil } from '../../../middleware/ErrorUtil';
import User from '../../auth/model/User';
import { EmailService } from '../email/EmailService';
import Notification from '../model/Notification';

export default class SupportEventHandler {
  onTicketUpdated = async (event: any) => {
    console.log(`[Notification] Ticket: ${event.ticket._id} updated`);
    // notify the user if the agent is sending the message
    if (!event.isUser) {
      await Notification.insertNotification(
        event.ticket.requester as any,
        event.user ? event.user._id : null,
        `New message on ticket #${event.ticket.subject}`,
        `${event.user ? event.user.fullName : event.body?.fullName} has sent a new message on ticket #${event.ticket.subject}`,
        'support',
        event.ticket._id
      );
    }

    // add a notification to the tickets assigned agent if there is one
    if (event.assignee) {
      // find the agent
      const agent = await User.findById(event.assignee);
      // if the agent is found, add the notification
      if (agent) {
        await Notification.insertNotification(
          agent._id as any,
          event.user ? event.user._id : null,
          `New message on ticket #${event.ticket.subject}`,
          `${event.user ? event.user.fullName : event.body?.fullName} has sent a new message on ticket #${event.ticket.subject}`,
          'support',
          event.ticket._id
        );
      }
    }
  };
  onTicketCreated = async (event: any) => {
    console.log(`[Notification] Ticket: ${event.ticket._id} created`);
  };
}
