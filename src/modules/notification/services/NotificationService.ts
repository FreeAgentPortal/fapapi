// modules/notification/NotificationService.ts
import { EmailService } from '../email/EmailService';
import { SMSService } from '../sms/SMSService';
import NAthleteEventsService from './NAthleteEvents.service';
import NAuthService from './NAuthService';
import NBillingEventsService from './NBillingEvents.service';
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
    private readonly nbillingEventService: NBillingEventsService = new NBillingEventsService()
  ) {}
  public init() {
    EmailService.init('sendgrid');
    SMSService.init('twilio');
    this.nauthService.init();
    this.nclaimService.init();
    this.nticketService.init();
    this.searchReportEventService.init();
    this.nuserService.init();
    this.nconversationService.init();
    this.nteamsEventService.init();
    this.nathleteEventService.init();
    this.nbillingEventService.init();
  }
}
