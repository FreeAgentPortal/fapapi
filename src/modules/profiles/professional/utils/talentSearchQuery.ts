import { ParsedQs } from 'qs';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';

const MAX_KEYWORD_LENGTH = 100;
const MAX_FILTER_LENGTH = 4096;
const MAX_FILTER_CLAUSES = 20;
const MAX_IN_VALUES = 50;
const MAX_TEXT_FILTER_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9_]{1,64}$/;

const EXPERIENCE_LEVELS = new Set(['student', 'entry', 'mid', 'senior', 'executive']);
const VISIBILITIES = new Set(['public', 'teams_only', 'private']);
const JOB_SEARCH_STATUSES = new Set(['open', 'casual', 'closed']);
const POLICY_FIELDS = new Set(['isActive', 'visibility', 'jobSearchStatus']);
const FILTER_FIELDS = new Set([
  'desiredRoles',
  'industries',
  'experienceLevel',
  'location.city',
  'location.state',
  'location.country',
  'openToRemote',
  'openToRelocation',
  ...POLICY_FIELDS,
]);

export interface ParsedTalentSearchQuery {
  andFilters: Record<string, unknown>[];
  includeFilters: Record<string, unknown>[];
  keyword?: string;
  keywordPattern?: string;
  page: number;
  limit: number;
}

type QueryValue = string | ParsedQs | (string | ParsedQs)[] | undefined;

const badRequest = (message: string): never => {
  throw new ErrorUtil(message, 400);
};

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildFlexibleTextPattern = (value: string): string => {
  const tokens = value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(escapeRegex);

  return tokens.length > 0 ? tokens.join('[\\s_-]+') : escapeRegex(value.trim());
};

const optionalScalar = (value: QueryValue, name: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return badRequest(`${name} must be a single string value`);
  return value;
};

const parsePositiveInteger = (value: QueryValue, name: string, defaultValue: number, maximum?: number): number => {
  const scalar = optionalScalar(value, name);
  if (scalar === undefined || scalar === '') return defaultValue;
  if (!/^\d+$/.test(scalar)) return badRequest(`${name} must be a positive integer`);

  const parsed = Number(scalar);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum !== undefined && parsed > maximum)) {
    return badRequest(`${name} must be an integer between 1 and ${maximum ?? Number.MAX_SAFE_INTEGER}`);
  }

  return parsed;
};

const parseBoolean = (value: string, field: string): boolean => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return badRequest(`${field} must be true or false`);
};

const parseInOperator = (value: string, field: string, validateValue: (entry: string) => boolean): string[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return badRequest(`${field} must use a valid $in object`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return badRequest(`${field} must use a valid $in object`);
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length !== 1 || entries[0][0] !== '$in') {
    return badRequest(`${field} only supports the $in operator`);
  }

  const rawValues = entries[0][1];
  const values = Array.isArray(rawValues)
    ? rawValues
    : typeof rawValues === 'string'
      ? rawValues.split(',')
      : badRequest(`${field} $in must be a string or string array`);

  if (values.length === 0 || values.length > MAX_IN_VALUES) {
    return badRequest(`${field} $in must contain between 1 and ${MAX_IN_VALUES} values`);
  }

  const normalized = values.map((entry) => {
    if (typeof entry !== 'string') return badRequest(`${field} $in values must be strings`);
    const trimmed = entry.trim();
    if (!trimmed || !validateValue(trimmed)) return badRequest(`Invalid ${field} value`);
    return trimmed;
  });

  return [...new Set(normalized)];
};

const parsePolicyClause = (field: string, value: string): void => {
  if (field === 'isActive') {
    parseBoolean(value, field);
    return;
  }

  const allowed = field === 'visibility' ? VISIBILITIES : JOB_SEARCH_STATUSES;

  if (value.startsWith('{')) {
    parseInOperator(value, field, (entry) => allowed.has(entry));
    return;
  }

  if (!allowed.has(value)) badRequest(`Invalid ${field} value`);
};

const parseClause = (clause: string): Record<string, unknown> | null => {
  const separator = clause.indexOf(';');
  if (separator <= 0 || separator === clause.length - 1) return badRequest('Malformed filter clause');

  const field = clause.slice(0, separator).trim();
  const value = clause.slice(separator + 1).trim();

  if (!FILTER_FIELDS.has(field)) return badRequest(`Unsupported filter field: ${field}`);
  if (!value) return badRequest(`Missing value for ${field}`);

  if (POLICY_FIELDS.has(field)) {
    parsePolicyClause(field, value);
    return null;
  }

  if (field === 'desiredRoles' || field === 'industries') {
    return { [field]: { $in: parseInOperator(value, field, (entry) => SLUG_PATTERN.test(entry)) } };
  }

  if (field === 'experienceLevel') {
    if (!EXPERIENCE_LEVELS.has(value)) return badRequest('Invalid experienceLevel value');
    return { experienceLevel: value };
  }

  if (field === 'openToRemote' || field === 'openToRelocation') {
    return { [field]: parseBoolean(value, field) };
  }

  if (value.length > MAX_TEXT_FILTER_LENGTH) {
    return badRequest(`${field} cannot exceed ${MAX_TEXT_FILTER_LENGTH} characters`);
  }

  return { [field]: { $regex: escapeRegex(value), $options: 'i' } };
};

const parseFilterGroup = (value: QueryValue, name: string): Record<string, unknown>[] => {
  const scalar = optionalScalar(value, name);
  if (scalar === undefined || scalar.trim() === '') return [];
  if (scalar.length > MAX_FILTER_LENGTH) return badRequest(`${name} cannot exceed ${MAX_FILTER_LENGTH} characters`);

  const clauses = scalar.split('|');
  if (clauses.length > MAX_FILTER_CLAUSES) {
    return badRequest(`${name} cannot contain more than ${MAX_FILTER_CLAUSES} clauses`);
  }

  return clauses.map(parseClause).filter((filter): filter is Record<string, unknown> => filter !== null);
};

export const parseTalentSearchQuery = (query: ParsedQs): ParsedTalentSearchQuery => {
  const keywordValue = optionalScalar(query.keyword, 'keyword');
  const keyword = keywordValue?.trim() || undefined;

  if (keyword && keyword.length > MAX_KEYWORD_LENGTH) {
    return badRequest(`keyword cannot exceed ${MAX_KEYWORD_LENGTH} characters`);
  }

  return {
    andFilters: parseFilterGroup(query.filterOptions, 'filterOptions'),
    includeFilters: parseFilterGroup(query.includeOptions, 'includeOptions'),
    keyword,
    keywordPattern: keyword ? buildFlexibleTextPattern(keyword) : undefined,
    page: parsePositiveInteger(query.pageNumber, 'pageNumber', 1),
    limit: parsePositiveInteger(query.limit, 'limit', 20, 50),
  };
};

