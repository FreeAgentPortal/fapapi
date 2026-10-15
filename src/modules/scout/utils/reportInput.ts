import { fail, text } from './portfolioInput';

export function validateReportQuery(query: any) {
  const fields = new Set(['_id', 'athleteId', 'scoutId', 'submissionId', 'submissionVersion', 'reviewId',
    'sport', 'league', 'reportType', 'status', 'isDraft', 'isFinalized', 'isPublic', 'tags',
    'diamondRating', 'createdAt', 'updatedAt', 'athlete.name', 'scout.name']);
  for (const key of ['filterOptions', 'includeOptions', 'sortOptions', 'keyword']) {
    if (query[key] !== undefined && (typeof query[key] !== 'string' || query[key].length > 4000)) fail(`Invalid ${key}`);
  }
  for (const key of ['filterOptions', 'includeOptions']) {
    for (const clause of (query[key] ?? '').split('|').filter(Boolean)) {
      if (!fields.has(clause.split(';')[0]) || !clause.includes(';')) fail('Unsupported report filter');
    }
  }
  for (const field of (query.sortOptions ?? '').split(';').filter(Boolean)) {
    if (!fields.has(field.replace(/^-/, ''))) fail('Unsupported report sort');
  }
}

export function reportInput(data: any) {
  const input: any = {};
  for (const key of ['sport', 'league', 'observations', 'recommendations']) {
    if (data[key] !== undefined) input[key] = text(data[key], key, key === 'sport' || key === 'league' ? 200 : 20000);
  }
  if (data.reportType !== undefined) {
    if (!['game', 'evaluation', 'camp', 'combine', 'interview', 'other'].includes(data.reportType)) fail('Invalid report type');
    input.reportType = data.reportType;
  }
  for (const key of ['strengths', 'weaknesses', 'verifiedMetrics', 'unverifiedMetrics', 'tags']) {
    if (data[key] !== undefined) {
      if (!Array.isArray(data[key]) || data[key].length > 100) fail(`Invalid ${key}`);
      input[key] = data[key].map((entry: unknown) => text(entry, key, 2000, true));
    }
  }
  for (const key of ['isPublic', 'isDraft']) {
    if (data[key] !== undefined) {
      if (typeof data[key] !== 'boolean') fail(`Invalid ${key}`);
      input[key] = data[key];
    }
  }
  if (data.ratingBreakdown !== undefined) {
    if (!data.ratingBreakdown || typeof data.ratingBreakdown !== 'object' || Array.isArray(data.ratingBreakdown)) fail('Invalid rating breakdown');
    const entries = Object.entries(data.ratingBreakdown);
    if (entries.length > 100) fail('Too many rating categories');
    input.ratingBreakdown = {};
    for (const [key, value] of entries as [string, any][]) {
      if (!/^[a-zA-Z][a-zA-Z0-9_ -]{0,99}$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key)) fail('Invalid rating category');
      if (!value || typeof value.score !== 'number' || !Number.isFinite(value.score) || value.score < 1 || value.score > 5) fail('Scores must be between 1 and 5');
      input.ratingBreakdown[key] = { score: value.score, comments: text(value.comments ?? '', 'rating comments', 5000) };
    }
  }
  return input;
}
