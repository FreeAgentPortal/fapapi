// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import RegistrationEventHandler from '../handler/RegistrationEventHandler';

/**
 * @description - Handles the notification services related to user authentication events.
 * @class NAuthService
 */
export default class NAuthService {
  constructor(private readonly registrationEventHandler: RegistrationEventHandler = new RegistrationEventHandler()) {}
  public init() {
    eventBus.subscribe('email.verify', this.registrationEventHandler.emailVerification);
    eventBus.subscribe('email.verified', this.registrationEventHandler.emailVerified);
    eventBus.subscribe('password.reset.requested', this.registrationEventHandler.passwordReset);
    eventBus.subscribe('password.reset.completed', this.registrationEventHandler.passwordResetCompleted);
  }
}
