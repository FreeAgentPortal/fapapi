// modules/notification/NotificationService.ts 
import { eventBus } from '../../lib/eventBus';
import { EmailService } from './email/EmailService';
import { handleUserRegistered } from './handler/userRegisteredHandler';

export class NotificationService {
  public static init() {
    EmailService.init("sendgrid");

    eventBus.subscribe('user.registered', handleUserRegistered);
  }
}
