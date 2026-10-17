import BillingAccount from '../../../auth/model/BillingAccount';
import SmartRetriesService from '../SmartRetriesService';
import PaymentProcessor from '../../classes/PaymentProcess';

jest.mock('../../../../utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), warn: jest.fn() } }));

// Small persistence double: evaluate the Mongo predicates so competing callers
// and stale snapshots exercise the actual compare-and-set filters in the service.
const valueAt = (doc: any, path: string) => path.split('.').reduce((v, key) => v?.[key], doc);
function matches(doc: any, filter: any): boolean {
  return Boolean(doc) && Object.entries(filter).every(([path, condition]: [string, any]) => {
    if (path === '$or') return condition.some((branch: any) => matches(doc, branch));
    const value = valueAt(doc, path);
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      return Object.entries(condition).every(([op, expected]: [string, any]) => {
        if (op === '$exists') return (value !== undefined) === expected;
        if (op === '$ne') return value !== expected;
        if (op === '$in') return expected.includes(value);
        if (op === '$lte') return value != null && value <= expected;
        if (op === '$lt') return value != null && value < expected;
        if (op === '$gte') return value != null && value >= expected;
        throw new Error(`Unsupported mock predicate ${op}`);
      });
    }
    return condition instanceof Date ? value?.getTime() === condition.getTime() : value === condition;
  });
}
function apply(doc: any, update: any) {
  for (const [operation, entries] of Object.entries(update) as [string, any][]) {
    for (const [path, value] of Object.entries(entries)) {
      const keys = path.split('.');
      const leaf = keys.pop()!;
      const target = keys.reduce((object, key) => object[key] ??= {}, doc);
      if (operation === '$set') target[leaf] = structuredClone(value);
      else if (operation === '$unset') delete target[leaf];
      else if (operation === '$inc') target[leaf] = (target[leaf] ?? 0) + Number(value);
    }
  }
  doc.updatedAt = new Date(doc.updatedAt.getTime() + 1);
}

describe('SmartRetries collection and recovery', () => {
  let account: any;
  let processor: PaymentProcessor;
  let charge: jest.Mock;
  let receipt: jest.Mock;
  const declined = { success: false, outcome: 'declined', declineCode: 'insufficient_funds', message: 'Insufficient funds', transactionId: 'pi_failed' };
  const succeeded = { success: true, outcome: 'succeeded', status: 'succeeded', transactionId: 'pi_paid' };
  const at = (day: number) => new Date(`2026-10-${String(day + 1).padStart(2, '0')}T16:00:00Z`);
  const collect = (day: number) => SmartRetriesService.collect('billing', processor, receipt, at(day));

  beforeEach(() => {
    account = {
      _id: 'billing', updatedAt: at(0), status: 'active', needsUpdate: false, vaulted: true,
      nextBillingDate: new Date('2026-10-01T00:00:00Z'), credits: 2, isYearly: false, profileType: 'professional',
      plan: { _id: 'plan', name: 'Pro', price: 10 }, payor: { _id: 'user' },
      processor: 'stripe', paymentProcessorData: { stripe: { customer: { id: 'cus' }, paymentMethod: { id: 'pm_old' } } },
    };
    charge = jest.fn().mockResolvedValue(declined);
    receipt = jest.fn().mockResolvedValue({});
    processor = { getProcessorName: () => 'stripe', processPayment: charge } as any;
    jest.spyOn(BillingAccount, 'findOne').mockImplementation(((filter: any) => {
      const snapshot = matches(account, filter) ? structuredClone(account) : null;
      return { populate: function () { return this; }, then: (resolve: any) => Promise.resolve(snapshot).then(resolve) };
    }) as any);
    jest.spyOn(BillingAccount, 'findOneAndUpdate').mockImplementation((async (filter: any, update: any) => {
      if (!matches(account, filter)) return null;
      apply(account, update);
      return structuredClone(account);
    }) as any);
    jest.spyOn(BillingAccount, 'updateOne').mockImplementation((async (filter: any, update: any) => {
      if (!matches(account, filter)) return { matchedCount: 0 };
      apply(account, update);
      return { matchedCount: 1 };
    }) as any);
    jest.spyOn(BillingAccount, 'updateMany').mockImplementation((async (filter: any, update: any) => {
      if (matches(account, filter)) apply(account, update);
      return {};
    }) as any);
    jest.spyOn(BillingAccount, 'exists').mockImplementation((async (filter: any) => matches(account, filter) ? { _id: account._id } : null) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps access through days 0/1/3/5 and suspends on the fifth failed attempt at day 7', async () => {
    for (const [index, day] of [0, 1, 3, 5, 7].entries()) {
      await collect(day);
      expect(account.smartRetries.attemptCount).toBe(index + 1);
      expect(account.status).toBe(day === 7 ? 'suspended' : 'active');
      expect(account.needsUpdate).toBe(day === 7);
      expect(account.credits).toBe(2);
      expect(account.nextBillingDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    }
    expect(account.smartRetries.nextAttemptAt).toBeUndefined();
    expect(charge).toHaveBeenCalledTimes(5);
    expect(receipt).toHaveBeenCalledTimes(5);
    expect(charge.mock.calls.every(([details]) => details.amount === 8)).toBe(true);
    expect(new Set(charge.mock.calls.map(([details]) => details.idempotencyKey)).size).toBe(5);
  });

  it.each([0, 1, 3, 5, 7])('settles on day %i, deducts credits once, and preserves the renewal anchor', async (successDay) => {
    for (const day of [0, 1, 3, 5, 7].filter(day => day <= successDay)) {
      if (day === successDay) charge.mockResolvedValue(succeeded);
      await collect(day);
    }
    expect(account.smartRetries).toBeUndefined();
    expect(account.status).toBe('active');
    expect(account.needsUpdate).toBe(false);
    expect(account.credits).toBe(0);
    expect(account.nextBillingDate.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    expect((await collect(successDay)).skipped).toBe(true);
  });

  it('keeps the annual renewal anchor after recovery', async () => {
    account.isYearly = true;
    await collect(0);
    charge.mockResolvedValue(succeeded);
    await collect(3);
    expect(account.nextBillingDate.toISOString()).toBe('2027-10-01T00:00:00.000Z');
  });

  it('settles credit-covered payments without submitting a processor charge', async () => {
    account.credits = 12;
    await collect(0);
    expect(charge).not.toHaveBeenCalled();
    expect(account.credits).toBe(2);
    expect(account.smartRetries).toBeUndefined();
    expect(receipt.mock.calls[0][1].data.covered_by_credits).toBe(true);
  });

  it('supports legacy accounts without a stored credits field', async () => {
    delete account.credits;
    charge.mockResolvedValue(succeeded);
    await collect(0);
    expect(account.smartRetries).toBeUndefined();
  });

  it('does not charge before the retry date or more than once on its day', async () => {
    await collect(0);
    expect((await collect(0)).skipped).toBe(true);
    await collect(1);
    expect((await collect(2)).skipped).toBe(true);
    expect(charge).toHaveBeenCalledTimes(2);
  });

  it('skips missed slots and expires the window without making up attempts', async () => {
    await collect(0);
    await collect(4);
    expect(account.smartRetries.nextAttemptAt.toISOString()).toBe('2026-10-06T00:00:00.000Z');
    await SmartRetriesService.expireRetries(at(8));
    expect(account.status).toBe('suspended');
    expect(account.needsUpdate).toBe(true);
    expect(account.smartRetries.attemptCount).toBe(2);
    expect((await collect(8)).skipped).toBe(true);
  });

  it('allows only one overlapping worker or manual trigger to claim an attempt', async () => {
    const outcomes = await Promise.all([collect(0), collect(0), collect(0)]);
    expect(outcomes.filter(result => result.skipped)).toHaveLength(2);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(receipt).toHaveBeenCalledTimes(1);
  });

  it.each(['expired_card', 'authentication_required', undefined])('does not retry decline %s', async (declineCode) => {
    charge.mockResolvedValue({ ...declined, declineCode });
    await collect(0);
    expect(account.smartRetries.status).toBe('exhausted');
    expect(account.needsUpdate).toBe(true);
    expect(account.status).toBe('suspended');
  });

  it('stops an existing retry sequence if the next decline is not retryable', async () => {
    await collect(0);
    charge.mockResolvedValue({ ...declined, declineCode: 'expired_card' });
    await collect(1);
    expect(account.smartRetries.status).toBe('exhausted');
    expect(account.smartRetries.nextAttemptAt).toBeUndefined();
  });

  it('does not submit or count a preflight failure', async () => {
    delete account.paymentProcessorData.stripe;
    await collect(0);
    expect(account.needsUpdate).toBe(true);
    expect(account.smartRetries?.attemptCount ?? 0).toBe(0);
    expect(charge).not.toHaveBeenCalled();
  });

  it.each(['deferred', undefined])('includes scheduled first payments with initial status %s', async (initialSubscriptionChargeStatus) => {
    account.initialSubscriptionChargeStatus = initialSubscriptionChargeStatus;
    account.status = 'trialing';
    await collect(0);
    expect(account.status).toBe('trialing');
    expect(account.smartRetries.status).toBe('retrying');
  });

  it('does not enroll accounts already suspended before rollout', async () => {
    account.status = 'suspended';
    account.needsUpdate = true;
    expect((await collect(0)).skipped).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });

  it('waits for a due scheduled plan change instead of charging the previous plan', async () => {
    account.scheduledPlanChange = { plan: 'new-plan', effectiveDate: at(0) };
    expect((await collect(0)).skipped).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });

  it('queues an earlier remaining retry on a new card without resetting the budget', async () => {
    await collect(0);
    await collect(1);
    account.paymentProcessorData.stripe.paymentMethod.id = 'pm_new';
    SmartRetriesService.cardUpdated(account, 'pm_old', at(1));
    expect(account.smartRetries.nextAttemptAt.toISOString()).toBe('2026-10-03T16:00:00.000Z');
    await collect(2);
    expect(account.smartRetries.attemptCount).toBe(3);
    expect(account.smartRetries.nextAttemptAt.toISOString()).toBe('2026-10-06T00:00:00.000Z');
    expect(charge.mock.calls[2][0].paymentMethodId).toBe('pm_new');
  });

  it.each([false, true])('allows one post-exhaustion recovery, success=%s', async (success) => {
    await collect(0);
    await SmartRetriesService.expireRetries(at(8));
    account.paymentProcessorData.stripe.paymentMethod.id = 'pm_new';
    SmartRetriesService.cardUpdated(account, 'pm_old', at(8));
    expect(account.status).toBe('suspended');
    expect(account.needsUpdate).toBe(true);
    expect(account.smartRetries.status).toBe('recovery_pending');
    if (success) charge.mockResolvedValue(succeeded);
    await collect(9);
    expect(account.smartRetries?.status).toBe(success ? undefined : 'exhausted');
    expect(account.status).toBe(success ? 'active' : 'suspended');
    expect((await collect(10)).skipped).toBe(true);
  });

  it('does not grant recovery when the payment method did not change', async () => {
    await collect(0);
    await SmartRetriesService.expireRetries(at(8));
    SmartRetriesService.cardUpdated(account, 'pm_old', at(8));
    expect(account.smartRetries.status).toBe('exhausted');
  });

  it('blocks plan changes until payment resolves, but permits a card update between attempts', async () => {
    await collect(0);
    expect(() => SmartRetriesService.assertPlanChangeAllowed(account)).toThrow(/outstanding/);
    expect(() => SmartRetriesService.assertCardChangeAllowed(account)).not.toThrow();
    charge.mockResolvedValue(succeeded);
    await collect(1);
    expect(() => SmartRetriesService.assertPlanChangeAllowed(account)).not.toThrow();
  });

  it('does not collect a pending cancellation', async () => {
    await collect(0);
    account.pendingCancellation = true;
    expect((await collect(1)).skipped).toBe(true);
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it('does not count or submit a charge when cancellation wins after the claim', async () => {
    (BillingAccount.exists as jest.Mock).mockResolvedValueOnce(null);
    expect((await collect(0)).skipped).toBe(true);
    expect(charge).not.toHaveBeenCalled();
    expect(account.smartRetries.attemptCount).toBe(0);
  });

  it('holds a confirmed payment for reconciliation if local settlement fails', async () => {
    charge.mockResolvedValue(succeeded);
    const update = BillingAccount.updateOne as jest.Mock;
    update.mockImplementationOnce(update.getMockImplementation()!).mockRejectedValueOnce(new Error('Settlement unavailable'));
    await collect(0);
    expect(account.smartRetries.status).toBe('review');
    expect(account.smartRetries.outcome.transactionId).toBe('pi_paid');
    expect(account.credits).toBe(2);
    expect((await collect(1)).skipped).toBe(true);
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it('keeps the unpaid snapshot stable when live prices and credits change', async () => {
    await collect(0);
    account.plan.price = 20;
    account.credits = 5;
    charge.mockResolvedValue(succeeded);
    await collect(1);
    expect(charge.mock.calls[1][0].amount).toBe(8);
    expect(account.credits).toBe(3);
    expect(receipt.mock.calls[1][3].price).toBe(10);
  });

  it('schedules overdue card updates for the next daily run, not an immediate manual run', async () => {
    await collect(0);
    account.paymentProcessorData.stripe.paymentMethod.id = 'pm_new';
    SmartRetriesService.cardUpdated(account, 'pm_old', at(2));
    expect((await collect(2)).skipped).toBe(true);
    expect(account.smartRetries.nextAttemptAt.toISOString()).toBe('2026-10-04T16:00:00.000Z');
  });

  it('does not allow card replacement to extend day 7', async () => {
    await collect(0);
    account.paymentProcessorData.stripe.paymentMethod.id = 'pm_new';
    SmartRetriesService.cardUpdated(account, 'pm_old', at(7));
    await SmartRetriesService.expireRetries(at(8));
    expect(account.smartRetries.status).toBe('exhausted');
    expect((await collect(8)).skipped).toBe(true);
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it('does not automatically reclaim a worker-crash claim', async () => {
    await collect(0);
    account.smartRetries.status = 'processing';
    expect((await collect(7)).skipped).toBe(true);
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it('translates a stale card-update save into a conflict', async () => {
    account.save = jest.fn().mockRejectedValue({ name: 'DocumentNotFoundError' });
    await expect(SmartRetriesService.saveBillingChange(account)).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each(['unknown', 'throw', 'pending', 'receipt'])('blocks fresh charges after %s outcome', async (mode) => {
    if (mode === 'throw') charge.mockRejectedValue(new Error('Connection lost'));
    else if (mode === 'pending') charge.mockResolvedValue({ success: true, status: 'processing', outcome: 'unknown' });
    else if (mode === 'receipt') {
      charge.mockResolvedValue(succeeded);
      receipt.mockRejectedValue(new Error('Receipt storage unavailable'));
    } else charge.mockResolvedValue({ success: false, outcome: 'unknown' });
    await collect(0);
    expect(account.smartRetries.status).toBe('review');
    expect(account.smartRetries.attemptCount).toBe(1);
    expect(() => SmartRetriesService.assertCardChangeAllowed(account)).toThrow(/reconciliation/);
    expect((await collect(1)).skipped).toBe(true);
    expect(charge).toHaveBeenCalledTimes(1);
    if (mode === 'receipt') expect(account.smartRetries.outcome.transactionId).toBe('pi_paid');
  });
});
