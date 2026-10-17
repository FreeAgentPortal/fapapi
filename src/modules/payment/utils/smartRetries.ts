import type { SmartRetriesState } from '../../auth/model/BillingAccount';

export const SMART_RETRY_DAYS = [1, 3, 5, 7] as const;

export function retryDate(dueDate: Date, day: number): Date {
  const date = new Date(dueDate);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + day);
  return date;
}

export function retryDeadline(dueDate: Date): Date {
  return new Date(retryDate(dueDate, 8).getTime() - 1);
}

export function nextRetry(state: SmartRetriesState, now: Date): { slot: number; date: Date } | undefined {
  if (state.recovery || state.attemptCount >= 5 || now > state.deadline) return;
  for (let slot = state.retrySlot + 1; slot < SMART_RETRY_DAYS.length; slot++) {
    const date = retryDate(state.dueDate, SMART_RETRY_DAYS[slot]);
    if (date > now) return { slot, date };
  }
}

// No timezone dependency is needed: LA's daily 09:00 occurs on a whole UTC hour,
// including on DST transition days. Choose the next occurrence strictly after now.
export function nextDailyBillingRun(now: Date): Date {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23' });
  const candidate = new Date(now);
  candidate.setUTCMinutes(0, 0, 0);
  for (let offset = 0; offset < 27; offset++) {
    candidate.setUTCHours(candidate.getUTCHours() + 1);
    if (hour.format(candidate) === '09') return candidate;
  }
  throw new Error('Unable to calculate next daily billing run');
}
