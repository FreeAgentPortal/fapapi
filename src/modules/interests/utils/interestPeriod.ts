export interface InterestPeriod {
  key: string;
  startsAt: Date;
  resetsAt: Date;
}

export function getInterestPeriod(now: Date = new Date()): InterestPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startsAt = new Date(Date.UTC(year, month, 1));
  const resetsAt = new Date(Date.UTC(year, month + 1, 1));

  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    startsAt,
    resetsAt,
  };
}

export function getInterestCooldownEnd(lastExpressedAt: Date): Date {
  const cooldownEnd = new Date(lastExpressedAt);
  cooldownEnd.setUTCDate(cooldownEnd.getUTCDate() + 90);
  return cooldownEnd;
}

