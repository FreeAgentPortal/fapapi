// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import ConversationEventHandler from '../handler/Conversation.handler';

/**
 * @Description - Handles the notification services related to conversation events.
 */
export default class NConversationService {
  constructor(private readonly handler: ConversationEventHandler = new ConversationEventHandler()) {}
  public init() {
    eventBus.subscribe('conversation.message', (e: any) => this.handler.messageSent(e));
    eventBus.subscribe('conversation.started', (e: any) => this.handler.conversationStarted(e));
  }
}
