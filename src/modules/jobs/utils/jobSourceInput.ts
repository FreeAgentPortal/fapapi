import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { JobSourceProvider } from '../models/JobSource';

export function sourceBody(input: unknown, allowed: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ErrorUtil('A job source object is required', 400);
  }
  const body = input as Record<string, unknown>;
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new ErrorUtil(`Only these fields are accepted: ${allowed.join(', ')}`, 400);
  }
  return body;
}

export function sourceText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    throw new ErrorUtil(`${field} must be a nonempty string of at most 200 characters`, 400);
  }
  return value.trim();
}

export function sourceEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ErrorUtil('enabled must be a boolean', 400);
  return value;
}

// Only provider-owned board URLs are accepted. Fetch URLs are constructed separately;
// admin input can never select an arbitrary server or a redirect destination.
export function parseSourceUrl(provider: unknown, value: unknown): {
  provider: JobSourceProvider; url: string; boardToken: string; region: 'global' | 'eu';
} {
  if (provider !== 'greenhouse' && provider !== 'lever') {
    throw new ErrorUtil('provider must be greenhouse or lever', 400);
  }
  let url: URL;
  try {
    if (typeof value !== 'string' || value.length > 2048) throw new Error();
    url = new URL(value);
  } catch {
    throw new ErrorUtil('A valid provider board URL is required', 400);
  }
  const hosts = provider === 'greenhouse'
    ? ['boards.greenhouse.io', 'job-boards.greenhouse.io']
    : ['jobs.lever.co', 'jobs.eu.lever.co'];
  const match = /^\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname) || !match) {
    throw new ErrorUtil('Use an HTTPS Greenhouse or Lever board URL, such as https://jobs.lever.co/organization', 400);
  }
  const boardToken = match[1].toLowerCase();
  const region = url.hostname === 'jobs.eu.lever.co' ? 'eu' : 'global';
  const host = provider === 'greenhouse' ? 'job-boards.greenhouse.io' : url.hostname;
  return { provider, boardToken, region, url: `https://${host}/${boardToken}` };
}
