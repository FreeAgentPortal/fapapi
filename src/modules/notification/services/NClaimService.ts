// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import ClaimEventHandlers from '../handler/ClaimEventHandlers';

/**
 * @Description - Handles the notification services related to claim events.
 */
export default class NClaimService {
  constructor(private readonly handler: ClaimEventHandlers = new ClaimEventHandlers()) {}
  public init() {
    eventBus.subscribe('claim.created', this.handler.claimCreated);
  }
}
