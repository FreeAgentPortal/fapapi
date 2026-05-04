// modules/notification/NotificationService.ts
import { eventBus } from '../../../lib/eventBus';  
import TeamEventsHandler from '../handler/TeamsEvents.handler';

/**
 * @description - Handles the notification services related to user authentication events.
 * @class NUserService
 */
export default class NTeamsEventService {
  constructor(private readonly handler: TeamEventsHandler = new TeamEventsHandler()) {}
  public init() {
    eventBus.subscribe('team.invited', this.handler.onTeamInvited);
  }
}
