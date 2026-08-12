// modules/notification/services/NScoutService.ts
import { eventBus } from '../../../lib/eventBus';
import ScoutEventsHandler from '../handler/ScoutEvents.handler';

/**
 * @Description - Registers notification handlers for scout events.
 */
export default class NScoutService {
  constructor(private readonly handler: ScoutEventsHandler = new ScoutEventsHandler()) {}
  public init() {
    eventBus.subscribe('scout.report.submitted', (event) => this.handler.scoutReportSubmitted(event));
  }
}
