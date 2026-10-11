import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { FEATURE_UPDATE_PORTALS, FeatureUpdateFields, FeatureUpdatePortal } from '../types';

export function requirePortal(value: unknown): FeatureUpdatePortal {
  if (typeof value !== 'string' || !FEATURE_UPDATE_PORTALS.includes(value as FeatureUpdatePortal)) {
    throw new ErrorUtil(`belongs_to must be one of: ${FEATURE_UPDATE_PORTALS.join(', ')}`, 400);
  }
  return value as FeatureUpdatePortal;
}

export function isSafePublicPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !/[\u0000-\u0020\\]/.test(value);
}

export function isSafeDestination(value: string): boolean {
  if (isSafePublicPath(value)) return true;
  if (/[\u0000-\u0020\\]/.test(value)) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export function isReleaseDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function inputObject(value: unknown, allowed: string[], path = 'body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ErrorUtil(`${path} must be an object`, 400);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !allowed.includes(key))) throw new ErrorUtil(`${path} contains unsupported fields`, 400);
  return result;
}

function text(value: unknown, path: string, max: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new ErrorUtil(`${path} must be a nonempty string of at most ${max} characters`, 400);
  }
}

export function requireRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new ErrorUtil('revision must be a nonnegative integer', 400);
  return value;
}

export function parseTitle(value: unknown): string {
  text(value, 'title', 200);
  return value.trim();
}

export function parseFeatureUpdateInput(input: unknown, partial = false): Partial<FeatureUpdateFields> {
  const allowed = ['key', 'name', 'description', 'releasedAt', 'badge', 'highlights', 'media', 'action', 'enabled', 'belongs_to', 'displayOrder'];
  const body = inputObject(input, allowed);
  if (!Object.keys(body).length) throw new ErrorUtil('No announcement fields provided', 400);
  for (const field of ['key', 'name', 'description', 'releasedAt', 'belongs_to']) {
    if (!partial && body[field] === undefined) throw new ErrorUtil(`${field} is required`, 400);
  }
  // A new key represents a new announcement; editing must preserve acknowledgment identity.
  if (partial && 'key' in body) throw new ErrorUtil('key is immutable; create a new announcement to announce a new version', 400);
  for (const [field, max] of Object.entries({ key: 120, name: 200, description: 5000, releasedAt: 10, badge: 80 })) {
    if (field === 'badge' && body[field] === null) continue;
    if (field in body) text(body[field], field, max);
  }
  if ('key' in body && body.key !== (body.key as string).trim()) throw new ErrorUtil('key must not have surrounding whitespace', 400);
  if ('releasedAt' in body && !isReleaseDate(body.releasedAt as string)) throw new ErrorUtil('releasedAt must be a valid YYYY-MM-DD date', 400);
  if ('enabled' in body && typeof body.enabled !== 'boolean') throw new ErrorUtil('enabled must be a boolean', 400);
  if ('displayOrder' in body && (typeof body.displayOrder !== 'number' || !Number.isSafeInteger(body.displayOrder) || body.displayOrder < 0)) {
    throw new ErrorUtil('displayOrder must be a nonnegative integer', 400);
  }
  if ('belongs_to' in body) {
    if (!Array.isArray(body.belongs_to) || !body.belongs_to.length) throw new ErrorUtil('belongs_to must be a nonempty array of portal tags', 400);
    body.belongs_to.forEach(requirePortal);
    if (new Set(body.belongs_to).size !== body.belongs_to.length) throw new ErrorUtil('belongs_to must not contain duplicate tags', 400);
  }
  if ('highlights' in body) {
    if (!Array.isArray(body.highlights) || body.highlights.length > 30) throw new ErrorUtil('highlights must be an array of at most 30 strings', 400);
    body.highlights.forEach((value, index) => text(value, `highlights[${index}]`, 1000));
  }
  if ('media' in body && body.media !== null) {
    const media = inputObject(body.media, ['type', 'src', 'alt', 'options'], 'media');
    if (!['image', 'video'].includes(media.type as string)) throw new ErrorUtil('media.type must be image or video', 400);
    text(media.src, 'media.src', 2048);
    text(media.alt, 'media.alt', 500);
    if (!isSafeDestination(media.src)) throw new ErrorUtil('media.src must be root-relative or HTTPS', 400);
    if ('options' in media) {
      const options = inputObject(media.options, ['placement', 'fit', 'aspectRatio', 'controls', 'autoPlay', 'muted', 'loop', 'poster'], 'media.options');
      if ('placement' in options && !['side', 'banner'].includes(options.placement as string)) throw new ErrorUtil('Invalid media placement', 400);
      if ('fit' in options && !['cover', 'contain'].includes(options.fit as string)) throw new ErrorUtil('Invalid media fit', 400);
      if ('aspectRatio' in options && (typeof options.aspectRatio !== 'number' || !Number.isFinite(options.aspectRatio) || options.aspectRatio <= 0)) throw new ErrorUtil('aspectRatio must be a positive finite number', 400);
      for (const field of ['controls', 'autoPlay', 'muted', 'loop']) {
        if (field in options && typeof options[field] !== 'boolean') throw new ErrorUtil(`${field} must be a boolean`, 400);
      }
      if ('poster' in options) {
        text(options.poster, 'media.options.poster', 2048);
        if (!isSafeDestination(options.poster)) throw new ErrorUtil('poster must be root-relative or HTTPS', 400);
      }
    }
  }
  if ('action' in body && body.action !== null) {
    const action = inputObject(body.action, ['type', 'label', 'href'], 'action');
    if (!['internal', 'external'].includes(action.type as string)) throw new ErrorUtil('action.type must be internal or external', 400);
    text(action.label, 'action.label', 120);
    text(action.href, 'action.href', 2048);
    if (!isSafeDestination(action.href) || (action.type === 'internal' && !isSafePublicPath(action.href))) throw new ErrorUtil('action.href must be root-relative for internal actions, or root-relative/HTTPS for external actions', 400);
  }
  // Null explicitly removes optional content on PATCH. Never pass raw update operators to MongoDB.
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, value === null ? undefined : value])) as Partial<FeatureUpdateFields>;
}
