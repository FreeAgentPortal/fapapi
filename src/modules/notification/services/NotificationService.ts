// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import { EmailService } from '../email/EmailService';
import NAuthService from './NAuthService';
import NClaimService from './NClaimService';

export default class NotificationService {
  constructor(private readonly nauthService: NAuthService = new NAuthService(), private readonly nclaimService: NClaimService = new NClaimService()) {}
  public init() {
    EmailService.init('sendgrid');

    this.nauthService.init();
    this.nclaimService.init();
  }
}
