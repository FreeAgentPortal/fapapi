// modules/notification/NotificationService.ts
import { EmailService } from '../email/EmailService';
import SearchReportEventHandler from './SearchReportEvent.service';
import NAuthService from './NAuthService';
import NClaimService from './NClaimService';
import NSupportService from './NSupportService';

export default class NotificationService {
  constructor(
    private readonly nauthService: NAuthService = new NAuthService(),
    private readonly nclaimService: NClaimService = new NClaimService(),
    private readonly nticketService: NSupportService = new NSupportService(),
    private readonly searchReportEventHandler: SearchReportEventHandler = new SearchReportEventHandler()
  ) {}
  public init() {
    EmailService.init('sendgrid');

    this.nauthService.init();
    this.nclaimService.init();
    this.nticketService.init();
    this.searchReportEventHandler.init();
  }
}
