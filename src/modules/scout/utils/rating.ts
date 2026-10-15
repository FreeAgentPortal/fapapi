import { fail } from './portfolioInput';

export function ratingFromBreakdown(breakdown: any): number {
  const values: any[] = breakdown instanceof Map ? [...breakdown.values()] : Object.values(breakdown ?? {});
  if (values.length < 3 || values.some(value => !value || typeof value.score !== 'number' || !Number.isFinite(value.score) || value.score < 1 || value.score > 5)) {
    fail('At least three categories with scores between 1 and 5 are required');
  }
  return Math.round(values.reduce((sum, value) => sum + value.score, 0) / values.length * 100) / 100;
}

export function aggregateRating(reports: any[]): number | undefined {
  const latest = new Map<string, any>();
  const scores: number[] = [];
  for (const report of reports) {
    if (report.status !== 'approved' || !report.isFinalized || !Number.isFinite(report.diamondRating) || report.diamondRating < 1 || report.diamondRating > 5) continue;
    if (!report.submissionId) { scores.push(report.diamondRating); continue; }
    const key = String(report.scoutId), previous = latest.get(key);
    if (!previous || report.submissionVersion > previous.submissionVersion ||
        (report.submissionVersion === previous.submissionVersion && String(report._id) > String(previous._id))) latest.set(key, report);
  }
  for (const report of latest.values()) scores.push(report.diamondRating);
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100) / 100 : undefined;
}
