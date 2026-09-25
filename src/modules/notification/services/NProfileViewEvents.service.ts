import { eventBus } from '../../../lib/eventBus';
import ProfileViewEventsHandler from '../handler/ProfileViewEvents.handler';

export default class NProfileViewEventsService {
  constructor(private readonly handler: ProfileViewEventsHandler = new ProfileViewEventsHandler()) {}

  public init(): void {
    eventBus.subscribe('profile.view.recorded', this.handler.profileViewRecorded);
  }
}
