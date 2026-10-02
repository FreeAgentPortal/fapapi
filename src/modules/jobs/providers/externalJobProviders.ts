import axios from 'axios';
import { IJobSource } from '../models/JobSource';
import { IJobPost } from '../models/JobPost';

export interface ExternalJob {
  externalId: string;
  title: string;
  description: string;
  applyUrl: string;
  sourceUrl: string;
  locationText: string;
  department: string;
  employmentType?: IJobPost['employmentType'];
  locationType?: IJobPost['locationType'];
  sourceUpdatedAt?: Date;
}

type JsonObject = Record<string, any>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider response object');
  return value as JsonObject;
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function required(value: unknown, field: string): string {
  const result = text(value);
  if (!result) throw new Error(`Provider job is missing ${field}`);
  return result;
}
function link(value: unknown): string {
  const url = new URL(required(value, 'URL'));
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid provider job URL');
  return url.toString();
}

// Descriptions are text, not trusted HTML. Clients must render them as text.
export function descriptionText(value: unknown): string {
  let result = text(value);
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  for (let pass = 0; pass < 3; pass++) {
    result = result.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
      if (!code.startsWith('#')) return entities[code.toLowerCase()];
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    });
  }
  return result.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:p|div|li|br|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/[\t ]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}

export function normalizeGreenhouseJob(value: unknown): ExternalJob {
  const job = object(value);
  if (!Number.isSafeInteger(job.id) || job.id <= 0) throw new Error('Invalid Greenhouse job ID');
  const updated = job.updated_at ? new Date(job.updated_at) : undefined;
  return {
    externalId: String(job.id), title: required(job.title, 'title'),
    description: descriptionText(job.content), applyUrl: link(job.absolute_url), sourceUrl: link(job.absolute_url),
    locationText: text(job.location?.name),
    department: Array.isArray(job.departments) ? job.departments.map((item: JsonObject) => text(item?.name)).filter(Boolean).join(', ') : '',
    sourceUpdatedAt: updated && Number.isFinite(updated.getTime()) ? updated : undefined,
  };
}

export function normalizeLeverJob(value: unknown): ExternalJob {
  const job = object(value);
  const employmentTypes: Record<string, IJobPost['employmentType']> = {
    'full-time': 'full_time', 'full time': 'full_time', 'part-time': 'part_time', 'part time': 'part_time',
    contract: 'contract', internship: 'internship', intern: 'internship', volunteer: 'volunteer',
  };
  const locationTypes: Record<string, IJobPost['locationType']> = { 'on-site': 'onsite', remote: 'remote', hybrid: 'hybrid' };
  const lists = Array.isArray(job.lists) ? job.lists.map((item: JsonObject) => `${text(item?.text)}\n${text(item?.content)}`) : [];
  return {
    externalId: required(job.id, 'id'), title: required(job.text, 'title'),
    description: [job.descriptionPlain || job.description, ...lists, job.additionalPlain || job.additional, job.salaryDescriptionPlain]
      .map(descriptionText).filter(Boolean).join('\n\n'),
    applyUrl: link(job.applyUrl), sourceUrl: link(job.hostedUrl),
    locationText: text(job.categories?.location), department: text(job.categories?.department || job.categories?.team),
    employmentType: employmentTypes[text(job.categories?.commitment).toLowerCase()],
    locationType: locationTypes[text(job.workplaceType)],
  };
}

export async function fetchExternalJobs(source: Pick<IJobSource, 'provider' | 'boardToken' | 'region'>): Promise<ExternalJob[]> {
  if (!/^[a-z0-9_-]+$/.test(source.boardToken)) throw new Error('Invalid source board token');
  const deadline = Date.now() + 90_000;
  const get = async (url: string, params: Record<string, unknown>): Promise<unknown> => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Provider fetch exceeded 90 seconds');
    const response = await axios.get(url, {
      params, timeout: Math.min(15_000, remaining), signal: AbortSignal.timeout(Math.min(15_000, remaining)),
      maxRedirects: 0, maxContentLength: 20 * 1024 * 1024,
      responseType: 'json', transitional: { silentJSONParsing: false },
      headers: { Accept: 'application/json' },
    });
    return response.data;
  };
  let jobs: ExternalJob[];
  if (source.provider === 'greenhouse') {
    const data = object(await get(`https://boards-api.greenhouse.io/v1/boards/${source.boardToken}/jobs`, { content: true }));
    if (!Array.isArray(data.jobs) || data.meta?.total !== data.jobs.length) throw new Error('Incomplete Greenhouse response');
    jobs = data.jobs.map(normalizeGreenhouseJob);
  } else if (source.provider === 'lever') {
    const host = source.region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
    jobs = [];
    for (let page = 0; ; page++) {
      if (page >= 100) throw new Error('Lever pagination limit reached; source was not fully fetched');
      const data = await get(`https://${host}/v0/postings/${source.boardToken}`, { mode: 'json', skip: page * 100, limit: 100 });
      if (!Array.isArray(data) || data.length > 100) throw new Error('Invalid Lever response');
      jobs.push(...data.map(normalizeLeverJob));
      if (data.length < 100) break;
    }
  } else {
    throw new Error('Unsupported job source provider');
  }
  if (new Set(jobs.map((job) => job.externalId)).size !== jobs.length) throw new Error('Provider returned duplicate job IDs; retry the full source');
  return jobs;
}
