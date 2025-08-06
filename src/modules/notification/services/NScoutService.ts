// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import ScoutEventsHandler from '../handler/ScoutEvents.handler';

/**
 * @Description - Handles the notification services related to claim events.
 */
export default class NClaimService {
  constructor(private readonly handler: ScoutEventsHandler = new ScoutEventsHandler()) {}
  public init() {
    eventBus.subscribe('scout.report.submitted', this.handler.scoutReportSubmitted);
  }
}
