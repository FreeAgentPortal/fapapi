import { getInterestCooldownEnd, getInterestPeriod } from '../interestPeriod';

describe('interest period utilities', () => {
  it('uses UTC calendar months and returns the next UTC month boundary', () => {
    const result = getInterestPeriod(new Date('2026-12-31T23:59:59.999Z'));

    expect(result.key).toBe('2026-12');
    expect(result.startsAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(result.resetsAt.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('sets the re-expression boundary to exactly 90 days', () => {
    const expressedAt = new Date('2026-01-31T23:00:00.000Z');

    expect(getInterestCooldownEnd(expressedAt).toISOString()).toBe('2026-05-01T23:00:00.000Z');
  });
});
