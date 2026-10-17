import BillingAccount from '../../../auth/model/BillingAccount';
import Receipt from '../../models/Receipt';
import PaymentProcessingHandler from '../PaymentProcessing.handler';
import { BillingHandler } from '../BillingHandler';
import SmartRetriesService from '../../services/SmartRetriesService';
import { eventBus } from '../../../../lib/eventBus';

describe('SmartRetries payment integration', () => {
  let billing: any;
  let processor: any;
  const declined = { success: false, outcome: 'declined', declineCode: 'insufficient_funds', message: 'Insufficient funds' };
  const pending = {
    status: 'retrying', dueDate: new Date('2026-10-01T00:00:00Z'), deadline: new Date('2026-10-08T23:59:59.999Z'),
    nextAttemptAt: new Date('2026-10-06T00:00:00Z'), attemptCount: 3, retrySlot: 2, attemptId: 'old-attempt',
  };
  const query = (value: any) => ({ populate: function () { return this; }, sort: function () { return this; }, then: (resolve: any) => Promise.resolve(value).then(resolve) });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T17:00:00Z'));
    billing = {
      _id: 'billing', profileId: 'profile', profileType: 'professional', status: 'active', needsUpdate: false,
      plan: { _id: 'plan', name: 'Pro', price: 10 }, payor: { _id: 'user', firstName: 'Test', lastName: 'User' },
      nextBillingDate: pending.dueDate, processor: 'stripe', isYearly: false, email: 'test@example.com', vaulted: true,
      paymentProcessorData: { stripe: { customer: { id: 'cus' }, paymentMethod: { id: 'pm_old' } } },
      updatedAt: new Date('2026-10-01T00:00:00Z'), save: jest.fn().mockResolvedValue(undefined), markModified: jest.fn(),
    };
    processor = { getProcessorName: () => 'stripe', processPayment: jest.fn().mockResolvedValue(declined) };
    (PaymentProcessingHandler as any).processor = processor;
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(BillingAccount, 'findById').mockReturnValue(query(billing) as any);
    jest.spyOn(BillingAccount, 'findByIdAndUpdate').mockResolvedValue(billing);
    jest.spyOn(eventBus, 'publish').mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    (PaymentProcessingHandler as any).processor = null;
  });

  it.each(['signup', 'setup', 'proration'])('keeps %s failures outside SmartRetries', async (kind) => {
    jest.spyOn(PaymentProcessingHandler as any, 'createFailureReceipt').mockResolvedValue({});
    const collect = jest.spyOn(SmartRetriesService, 'collect');
    if (kind === 'signup') await PaymentProcessingHandler.processInitialSubscriptionCharge('billing', 1000, new Date('2026-11-01'), 'Signup');
    if (kind === 'setup') await PaymentProcessingHandler.processPaymentForProfile('billing', 1000, false, 'Setup', 'setup_fee');
    if (kind === 'proration') await PaymentProcessingHandler.processPlanChangeCharge('billing', 1000, billing.plan, 'Upgrade');
    expect(collect).not.toHaveBeenCalled();
    expect(billing.smartRetries).toBeUndefined();
    if (kind !== 'proration') expect(BillingAccount.findByIdAndUpdate).toHaveBeenCalledWith('billing', { needsUpdate: true, status: 'suspended' });
    else expect(BillingAccount.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('creates a receipt with the decline code and publishes a failure event for each attempt', async () => {
    billing._id = '507f1f77bcf86cd799439011';
    billing.payor._id = '507f1f77bcf86cd799439012';
    billing.plan._id = '507f1f77bcf86cd799439013';
    jest.spyOn(Receipt.prototype, 'save').mockImplementation(async function (this: any) { return this; } as any);
    for (let index = 0; index < 3; index++) {
      const receipt = await (PaymentProcessingHandler as any).createFailureReceipt(billing, declined, 10, billing.plan, undefined, 'subscription');
      expect(receipt.failure.code).toBe('insufficient_funds');
      expect(receipt.status).toBe('failed');
    }
    expect(eventBus.publish).toHaveBeenCalledTimes(3);
    expect(eventBus.publish).toHaveBeenCalledWith('billing.payment.failed', expect.objectContaining({ receipt: expect.objectContaining({ revenueCategory: 'subscription' }) }));
  });

  it('finalizes cancellation and clears retry state even for a suspended account', async () => {
    billing.processor = undefined;
    billing.status = 'suspended';
    billing.smartRetries = pending;
    await PaymentProcessingHandler.finalizeAccountCancellation(billing);
    expect(BillingAccount.findByIdAndUpdate).toHaveBeenCalledWith('billing', expect.objectContaining({ status: 'inactive', pendingCancellation: false, $unset: { smartRetries: 1 } }));
  });

  it('routes the legacy vault update through card-only handling without advancing the renewal', async () => {
    billing.smartRetries = pending;
    jest.spyOn(BillingAccount, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(BillingAccount, 'findOne').mockReturnValue(query(billing) as any);
    const handler = new BillingHandler();
    jest.spyOn(handler, 'createPaymentMethod').mockResolvedValue({ billingId: 'billing', profileId: 'profile', processor: 'stripe', vaulted: true, paymentMethod: {} });
    await handler.updateVault({ params: { id: 'profile' }, body: { planId: 'plan', billingCycle: 'monthly' }, user: {} } as any);
    expect(handler.createPaymentMethod).toHaveBeenCalledTimes(1);
    expect(billing.nextBillingDate).toEqual(pending.dueDate);
    expect(billing.save).not.toHaveBeenCalled();
  });

  it.each([{ planId: 'another-plan' }, { planId: 'plan', billingCycle: 'yearly' }])('rejects plan/cycle changes through the legacy vault endpoint: %j', async (body) => {
    billing.smartRetries = pending;
    jest.spyOn(BillingAccount, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(BillingAccount, 'findOne').mockReturnValue(query(billing) as any);
    await expect(new BillingHandler().updateVault({ params: { id: 'profile' }, body, user: {} } as any)).rejects.toThrow(/outstanding/);
    expect(billing.save).not.toHaveBeenCalled();
  });

  it('rejects plan changes through the plan endpoint before any charge', async () => {
    billing.smartRetries = pending;
    jest.spyOn(BillingAccount, 'findOne').mockReturnValue(query(billing) as any);
    await expect(new BillingHandler().changePlan({ params: { id: 'profile' }, body: { planId: 'another-plan' } } as any)).rejects.toThrow(/outstanding/);
    expect(processor.processPayment).not.toHaveBeenCalled();
  });

  it('updates a card while retaining suspension and the unpaid renewal date', async () => {
    billing.smartRetries = { ...pending, status: 'exhausted' };
    billing.status = 'suspended';
    billing.needsUpdate = true;
    processor.createPaymentMethod = jest.fn().mockResolvedValue({ success: true, customerId: 'cus', data: { customer: { id: 'cus' }, paymentMethod: { id: 'pm_new', type: 'card', card: {} } } });
    const handler = new BillingHandler();
    jest.spyOn(handler as any, 'loadBillingForOwnerAction').mockResolvedValue(billing);
    jest.spyOn(handler as any, 'resolveBillingProcessor').mockResolvedValue(processor);
    await handler.createPaymentMethod({ body: { stripeToken: 'tok_test' }, user: {} } as any);
    expect(billing.status).toBe('suspended');
    expect(billing.needsUpdate).toBe(true);
    expect(billing.nextBillingDate).toEqual(pending.dueDate);
    expect(billing.smartRetries.status).toBe('recovery_pending');
    expect(billing.smartRetries.nextAttemptAt.toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(billing.$where).toMatchObject({ 'smartRetries.status': 'exhausted', 'smartRetries.attemptId': 'old-attempt' });
  });
});
