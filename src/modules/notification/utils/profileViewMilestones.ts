export const PROFILE_VIEW_TIMEZONE = 'America/New_York';
export const PROFILE_VIEW_MILESTONES = [1, 5, 10, 50] as const;

export interface ProfileViewPeriod {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

const easternDate = new Intl.DateTimeFormat('en-US', {
  timeZone: PROFILE_VIEW_TIMEZONE,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

function dateParts(date: Date): Record<string, string> {
  return Object.fromEntries(easternDate.formatToParts(date).map(({ type, value }) => [type, value]));
}

export function easternDay(date: Date): string {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// At 05:00 UTC New York is either midnight (EST) or 01:00 (EDT).
// Resolve each boundary separately, since a month can contain a DST transition.
function monthStart(year: number, monthIndex: number): Date {
  const candidate = new Date(Date.UTC(year, monthIndex, 1, 5));
  return new Date(candidate.getTime() - Number(dateParts(candidate).hour) * 60 * 60 * 1000);
}

export function profileViewPeriods(now: Date, launchedAt: Date): ProfileViewPeriod[] {
  const parts = dateParts(now);
  const year = Number(parts.year);
  const monthIndex = Number(parts.month) - 1;
  const makePeriod = (index: number): ProfileViewPeriod => {
    const start = monthStart(year, index);
    return {
      key: easternDay(start).slice(0, 7),
      label: new Intl.DateTimeFormat('en-US', { timeZone: PROFILE_VIEW_TIMEZONE, month: 'long', year: 'numeric' }).format(start),
      start,
      end: monthStart(year, index + 1),
    };
  };
  const current = makePeriod(monthIndex);
  return parts.day === '01' && launchedAt < current.start ? [makePeriod(monthIndex - 1), current] : [current];
}

export function highestProfileViewMilestone(count: number): number {
  return [...PROFILE_VIEW_MILESTONES].reverse().find((milestone) => count >= milestone) ?? 0;
}
