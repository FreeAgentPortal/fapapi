// modules/notification/NotificationService.ts
import { eventBus } from '../../lib/eventBus';
import { EmailService } from './email/EmailService';
import RegistrationEventHandler from './handler/RegistrationEventHandler'; 

export default class NotificationService {
  constructor(private readonly registrationEventHandler: RegistrationEventHandler = new RegistrationEventHandler()) {}
  public init() {
    EmailService.init('sendgrid');

    eventBus.subscribe('email.verify', this.registrationEventHandler.emailVerification);
    eventBus.subscribe('email.verified', this.registrationEventHandler.emailVerified);
  }
}
