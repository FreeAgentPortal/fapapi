// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus'; 
import UserEvents from '../handler/UserEvents.handler';

/**
 * @description - Handles the notification services related to user authentication events.
 * @class NUserService
 */
export default class NUserService {
  constructor(private readonly handler: UserEvents = new UserEvents()) {}
  public init() {
    eventBus.subscribe('user.passwordUpdated', this.handler.onPasswordUpdated);
  }
}
