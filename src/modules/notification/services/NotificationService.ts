// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import { EmailService } from '../email/EmailService';
import NAuthService from './NAuthService';
import NClaimService from './NClaimService';
import NSupportService from './NSupportService';

export default class NotificationService {
  constructor(
    private readonly nauthService: NAuthService = new NAuthService(),
    private readonly nclaimService: NClaimService = new NClaimService(),
    private readonly nticketService: NSupportService = new NSupportService()
  ) {}
  public init() {
    EmailService.init('sendgrid');

    this.nauthService.init();
    this.nclaimService.init();
    this.nticketService.init();
  }
}
