// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';
import AthleteEventHandler from '../handler/AthleteEvents.handler';
import ClaimEventHandlers from '../handler/ClaimEventHandlers';

/**
 * @Description - Handles the notification services related to athlete events.
 */
export default class NAthleteEvents {
  constructor(private readonly handler: AthleteEventHandler = new AthleteEventHandler()) {}
  public init() {
    eventBus.subscribe('athlete.profile.completion.alert', this.handler.profileIncomplete);
  }
}
