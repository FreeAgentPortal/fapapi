import { eventBus } from '../../../lib/eventBus';
import InterestEventsHandler, { AthleteInterestExpressedEvent } from '../handler/InterestEvents.handler';

export default class NInterestService {
  constructor(private readonly handler: InterestEventsHandler = new InterestEventsHandler()) {}

  public init(): void {
    eventBus.subscribe<AthleteInterestExpressedEvent>('athlete.interest.expressed', (event) => this.handler.interestExpressed(event));
  }
}
