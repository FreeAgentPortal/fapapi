// modules/notification/NotificationService.ts
import { EmailService } from '../email/EmailService';
import NAthleteEventsService from './NAthleteEvents.service';
import NAuthService from './NAuthService';
import NClaimService from './NClaimService';
import NConversationService from './NConversationService';
import NSupportService from './NSupportService';
import NTeamsEventService from './NTeamsEvent.service';
import NUserService from './NUserService';
import SearchReportEventService from './SearchReportEvent.service';

export default class NotificationService {
  constructor(
    private readonly nauthService: NAuthService = new NAuthService(),
    private readonly nclaimService: NClaimService = new NClaimService(),
    private readonly nticketService: NSupportService = new NSupportService(),
    private readonly searchReportEventService: SearchReportEventService = new SearchReportEventService(),
    private readonly nuserService: NUserService = new NUserService(),
    private readonly nconversationService: NConversationService = new NConversationService(),
    private readonly nteamsEventService: NTeamsEventService = new NTeamsEventService(),
    private readonly nathleteEventService: NAthleteEventsService = new NAthleteEventsService(),
  ) {}
  public init() {
    EmailService.init('sendgrid');
    this.nauthService.init();
    this.nclaimService.init();
    this.nticketService.init();
    this.searchReportEventService.init();
    this.nuserService.init();
    this.nconversationService.init();
    this.nteamsEventService.init();
    this.nathleteEventService.init();
  }
}
