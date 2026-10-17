import { nextDailyBillingRun, nextRetry, retryDate, retryDeadline } from '../smartRetries';
import type { SmartRetriesState } from '../../../auth/model/BillingAccount';

describe('SmartRetries schedule', () => {
  const dueDate = new Date('2026-10-01T00:00:00Z');
  const state = (retrySlot = -1, attemptCount = 1): SmartRetriesState => ({
    dueDate, deadline: retryDeadline(dueDate), retrySlot, attemptCount,
    status: 'processing', attemptId: 'attempt', recovery: false,
    amountCents: 1000, creditsCents: 0, isYearly: false,
    planSnapshot: { _id: 'plan', name: 'Plan', price: 10 },
  });

  it.each([[-1, 1], [0, 3], [1, 5], [2, 7]])('schedules the slot after %i on day %i', (slot, day) => {
    expect(nextRetry(state(slot, slot + 2), retryDate(dueDate, slot < 0 ? 0 : [1, 3, 5][slot])))
      .toEqual({ slot: slot + 1, date: retryDate(dueDate, day) });
  });

  it('skips missed slots instead of catching up several charges', () => {
    expect(nextRetry(state(0, 2), new Date('2026-10-05T16:00:00Z')))
      .toEqual({ slot: 2, date: new Date('2026-10-06T00:00:00Z') });
  });

  it('stops on deadline, attempt limit, final slot, or recovery', () => {
    expect(retryDeadline(dueDate).toISOString()).toBe('2026-10-08T23:59:59.999Z');
    expect(nextRetry(state(), new Date('2026-10-09T00:00:00Z'))).toBeUndefined();
    expect(nextRetry(state(-1, 5), dueDate)).toBeUndefined();
    expect(nextRetry(state(3), dueDate)).toBeUndefined();
    expect(nextRetry({ ...state(), recovery: true }, dueDate)).toBeUndefined();
  });

  it.each([
    ['2026-10-01T15:59:00Z', '2026-10-01T16:00:00Z'],
    ['2026-10-01T16:00:00Z', '2026-10-02T16:00:00Z'],
    ['2026-11-01T00:00:00Z', '2026-11-01T17:00:00Z'],
    ['2026-03-08T00:00:00Z', '2026-03-08T16:00:00Z'],
  ])('finds the next LA 9am run after %s', (now, expected) => {
    expect(nextDailyBillingRun(new Date(now))).toEqual(new Date(expected));
  });
});
