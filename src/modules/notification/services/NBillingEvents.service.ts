// modules/notification/services/NBillingEvents.service.ts
import { eventBus } from '../../../lib/eventBus';
import BillingEventHandler from '../handler/BillingEvents.handler';

/**
 * @Description - Handles the notification services related to billing/payment events.
 */
export default class NBillingEventsService {
  constructor(private readonly handler: BillingEventHandler = new BillingEventHandler()) {}

  public init() {
    eventBus.subscribe('billing.payment.success', this.handler.paymentSuccess);
    eventBus.subscribe('billing.payment.failed', this.handler.paymentFailed);
    eventBus.subscribe('billing.cancellation.requested', this.handler.cancellationRequested);
    eventBus.subscribe('billing.account.cancelled', this.handler.accountCancelled);

    console.info('[NBillingEventsService] Billing event listeners initialized');
  }
}
