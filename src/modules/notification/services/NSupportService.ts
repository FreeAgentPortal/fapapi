// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import SupportEventHandler from '../handler/SupportEvents.handler';

/**
 * @description - Handles the notification services related to user authentication events.
 * @class NAuthService
 */
export default class NAuthService {
  constructor(private readonly handler: SupportEventHandler = new SupportEventHandler()) {}
  public init() {
    eventBus.subscribe('support.ticket.created', this.handler.onTicketCreated);
    eventBus.subscribe('support.ticket.updated', this.handler.onTicketUpdated);
  }
}
