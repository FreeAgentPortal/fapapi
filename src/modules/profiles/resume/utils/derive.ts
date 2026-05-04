// services/resume/derive.ts (pure)
import { IResumeProfile, IExperience } from '../models/ResumeProfile';

export type ResumeSummary = {
  lastUpdated: Date;
  currentTeam?: string;
  primaryPosition?: string;
  totalYears?: number;
};

const yearsBetween = (start?: Date, end?: Date) => (start ? ((end ?? new Date()).getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000) : 0);

export const deriveSummary = (r: Pick<IResumeProfile, 'updatedAt' | 'experiences'>): ResumeSummary => {
  const sorted = [...r.experiences].sort((a, b) => (b.endDate?.getTime() ?? Infinity) - (a.endDate?.getTime() ?? Infinity));
  const current = sorted.find((e) => !e.endDate);
  const totalYears = r.experiences.map((e: any) => yearsBetween(e.startDate, e.endDate)).reduce((a: any, b: any) => a + b, 0);

  return {
    lastUpdated: r['updatedAt'] as unknown as Date,
    currentTeam: current?.orgName,
    primaryPosition: mode(sorted.map((e) => e.position).filter(Boolean) as string[]),
    totalYears: Math.round(totalYears * 10) / 10,
  };
};

/**
 * Finds the most frequently occurring string in an array (statistical mode).
 *
 * @param xs - Array of strings to analyze
 * @returns The string that appears most frequently, or undefined if the array is empty
 *
 * @example
 * ```typescript
 * mode(['developer', 'manager', 'developer', 'analyst']) // returns 'developer'
 * mode(['a', 'b', 'c']) // returns 'a' (first alphabetically when tied)
 * mode([]) // returns undefined
 * ```
 */
const mode = (xs: string[]) => {
  if (xs.length === 0) return undefined;

  // Create frequency map: { string: count }
  const freq = xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});

  // Sort by frequency (descending) and return the most frequent value
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
};
