import { Types } from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';

export type ManagedResumeSection = 'experience' | 'education' | 'award' | 'reference' | 'media';

export const MANAGED_RESUME_SECTIONS = new Set<ManagedResumeSection>([
  'experience',
  'education',
  'award',
  'reference',
  'media',
]);

const PROFILE_FIELDS = new Set([
  'fullName',
  'sport',
  'profileImageUrl',
  'bio',
  'birthPlace',
  'college',
  'highSchool',
  'graduationYear',
  'positions',
  'experienceYears',
  'strengths',
  'weaknesses',
  'testimony',
  'awards',
  'measurements',
  'metrics',
  'highlightVideos',
]);

const SUPPORTED_SPORT_KEYS = new Set(['football']);
const RESUME_VISIBILITIES = new Set(['public', 'private', 'link']);
const EXPERIENCE_LEVELS = new Set(['Pro', 'College', 'HighSchool', 'Club', 'Other']);
const MEDIA_KINDS = new Set(['video', 'image', 'link']);

const SECTION_FIELDS: Record<ManagedResumeSection, Set<string>> = {
  experience: new Set([
    'resumeId',
    'owner',
    'orgName',
    'league',
    'level',
    'position',
    'location',
    'startDate',
    'endDate',
    'achievements',
    'stats',
  ]),
  education: new Set([
    'resumeId',
    'owner',
    'school',
    'degreeOrProgram',
    'startDate',
    'endDate',
    'isCurrent',
    'notes',
  ]),
  award: new Set(['resumeId', 'owner', 'title', 'org', 'year', 'description']),
  reference: new Set(['resumeId', 'owner', 'name', 'role', 'organization', 'contact']),
  media: new Set(['resumeId', 'owner', 'kind', 'url', 'label']),
};

const SECTION_REQUIRED_FIELDS: Record<ManagedResumeSection, string[]> = {
  experience: ['orgName'],
  education: ['school'],
  award: ['title'],
  reference: ['name'],
  media: ['kind', 'url'],
};

export interface ValidatedManagedResumeBody {
  resumeId?: string;
  patch: Record<string, unknown>;
  changedFields: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new ErrorUtil(`${label} must be an object.`, 422);
  }
  return value;
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknownFields = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownFields.length > 0) {
    throw new ErrorUtil(`${label} contains forbidden or unknown fields: ${unknownFields.join(', ')}.`, 422);
  }
}

function requireString(value: unknown, label: string, options: { allowBlank?: boolean; maxLength?: number } = {}): string {
  if (typeof value !== 'string') {
    throw new ErrorUtil(`${label} must be a string.`, 422);
  }
  const normalized = value.trim();
  if (!options.allowBlank && !normalized) {
    throw new ErrorUtil(`${label} cannot be blank.`, 422);
  }
  if (options.maxLength && normalized.length > options.maxLength) {
    throw new ErrorUtil(`${label} cannot exceed ${options.maxLength} characters.`, 422);
  }
  return normalized;
}

function optionalString(value: unknown, label: string, maxLength?: number): string | null {
  if (value === null) {
    return null;
  }
  return requireString(value, label, { allowBlank: true, maxLength });
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ErrorUtil(`${label} must be a finite number.`, 422);
  }
  return value;
}

function integer(value: unknown, label: string, min?: number, max?: number): number {
  const parsed = finiteNumber(value, label);
  if (!Number.isInteger(parsed) || (min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
    const range = min !== undefined || max !== undefined ? ` between ${min ?? '-infinity'} and ${max ?? 'infinity'}` : '';
    throw new ErrorUtil(`${label} must be an integer${range}.`, 422);
  }
  return parsed;
}

function nullableInteger(value: unknown, label: string, min?: number, max?: number): number | null {
  return value === null ? null : integer(value, label, min, max);
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new ErrorUtil(`${label} must be an array.`, 422);
  }
  return value.map((entry, index) => requireString(entry, `${label}[${index}]`));
}

function validateMapKey(key: string, label: string): void {
  if (!key.trim() || key.startsWith('$') || key.includes('.')) {
    throw new ErrorUtil(`${label} contains an invalid key.`, 422);
  }
}

function numericOrStringMap(value: unknown, label: string): Record<string, string | number> {
  const object = requireObject(value, label);
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => {
      validateMapKey(key, label);
      if (typeof entry === 'number') {
        return [key, finiteNumber(entry, `${label}.${key}`)];
      }
      if (typeof entry === 'string') {
        return [key, entry.trim()];
      }
      throw new ErrorUtil(`${label}.${key} must be a string or finite number.`, 422);
    })
  );
}

function numericMap(value: unknown, label: string): Record<string, number> {
  const object = requireObject(value, label);
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => {
      validateMapKey(key, label);
      return [key, finiteNumber(entry, `${label}.${key}`)];
    })
  );
}

function validateUrl(value: unknown, label: string): string {
  const urlValue = requireString(value, label);
  try {
    const url = new URL(urlValue);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new ErrorUtil(`${label} must be a valid HTTP or HTTPS URL.`, 422);
  }
}

function validateDate(value: unknown, label: string, nullable = false): string | Date | null | undefined {
  if (nullable && value === null) {
    return null;
  }
  if (typeof value === 'string' && !value.trim()) {
    return nullable ? null : undefined;
  }
  if (!(typeof value === 'string' || value instanceof Date) || Number.isNaN(new Date(value).getTime())) {
    throw new ErrorUtil(`${label} must be a valid date.`, 422);
  }
  return value;
}

export function validatePathObjectId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw new ErrorUtil(`${label} must be a valid identifier.`, 400);
  }
  return value;
}

export function validateManagedOwner(value: unknown, athleteId: string): void {
  const owner = requireObject(value, 'owner');
  assertAllowedKeys(owner, new Set(['kind', 'ref']), 'owner');
  if (owner.kind !== 'AthleteProfile') {
    throw new ErrorUtil('owner.kind must be AthleteProfile.', 422);
  }
  if (typeof owner.ref !== 'string' || owner.ref !== athleteId) {
    throw new ErrorUtil('owner.ref must match the athlete path identifier.', 422);
  }
}

export function validateManagedResumeCreateBody(value: unknown, athleteId: string): void {
  const body = requireObject(value, 'Request body');
  assertAllowedKeys(body, new Set(['owner']), 'Request body');
  validateManagedOwner(body.owner, athleteId);
}

export function validateManagedVisibilityBody(value: unknown): 'public' | 'private' | 'link' {
  const body = requireObject(value, 'Request body');
  assertAllowedKeys(body, new Set(['visibility']), 'Request body');
  if (typeof body.visibility !== 'string' || !RESUME_VISIBILITIES.has(body.visibility)) {
    throw new ErrorUtil('visibility must be public, private, or link.', 422);
  }
  return body.visibility as 'public' | 'private' | 'link';
}

export function validateManagedProfileUpdate(value: unknown): Record<string, unknown> {
  const body = requireObject(value, 'Request body');
  assertAllowedKeys(body, PROFILE_FIELDS, 'Request body');
  if (Object.keys(body).length === 0) {
    throw new ErrorUtil('At least one managed profile field is required.', 422);
  }

  const update: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(body)) {
    switch (key) {
      case 'fullName':
        update.fullName = requireString(entry, 'fullName');
        break;
      case 'sport': {
        const sport = requireString(entry, 'sport').toLowerCase();
        if (!SUPPORTED_SPORT_KEYS.has(sport)) {
          throw new ErrorUtil(`sport must be one of: ${Array.from(SUPPORTED_SPORT_KEYS).join(', ')}.`, 422);
        }
        update.sport = sport;
        break;
      }
      case 'profileImageUrl':
        update.profileImageUrl = entry === null ? null : validateUrl(entry, 'profileImageUrl');
        break;
      case 'bio':
        update.bio = optionalString(entry, 'bio', 500);
        break;
      case 'birthPlace': {
        const birthPlace = requireObject(entry, 'birthPlace');
        assertAllowedKeys(birthPlace, new Set(['city', 'state', 'country']), 'birthPlace');
        for (const field of ['city', 'state', 'country']) {
          if (!(field in birthPlace)) {
            throw new ErrorUtil(`birthPlace.${field} is required.`, 422);
          }
        }
        update.birthPlace = {
          city: requireString(birthPlace.city, 'birthPlace.city', { allowBlank: true }),
          state: requireString(birthPlace.state, 'birthPlace.state', { allowBlank: true }),
          country: requireString(birthPlace.country, 'birthPlace.country', { allowBlank: true }),
        };
        break;
      }
      case 'college':
      case 'highSchool':
      case 'strengths':
      case 'weaknesses':
      case 'testimony':
        update[key] = optionalString(entry, key);
        break;
      case 'graduationYear':
        update.graduationYear = nullableInteger(entry, 'graduationYear', 1900, new Date().getFullYear() + 10);
        break;
      case 'experienceYears':
        update.experienceYears = nullableInteger(entry, 'experienceYears', 0, 50);
        break;
      case 'positions': {
        if (!Array.isArray(entry)) {
          throw new ErrorUtil('positions must be an array.', 422);
        }
        update.positions = entry.map((position, index) => {
          const object = requireObject(position, `positions[${index}]`);
          assertAllowedKeys(object, new Set(['name', 'abbreviation']), `positions[${index}]`);
          return {
            name: requireString(object.name, `positions[${index}].name`),
            abbreviation: requireString(object.abbreviation, `positions[${index}].abbreviation`),
          };
        });
        break;
      }
      case 'awards':
        update.awards = stringArray(entry, 'awards');
        break;
      case 'measurements':
        update.measurements = numericOrStringMap(entry, 'measurements');
        break;
      case 'metrics':
        update.metrics = numericMap(entry, 'metrics');
        break;
      case 'highlightVideos': {
        const urls = stringArray(entry, 'highlightVideos').map((url, index) =>
          validateUrl(url, `highlightVideos[${index}]`)
        );
        if (urls.length > 5) {
          throw new ErrorUtil('highlightVideos cannot contain more than 5 URLs.', 422);
        }
        update.highlightVideos = urls;
        break;
      }
    }
  }
  return update;
}

function normalizeLocation(value: unknown): Record<string, string> {
  const location = requireObject(value, 'location');
  assertAllowedKeys(location, new Set(['city', 'state', 'country']), 'location');
  return Object.fromEntries(
    Object.entries(location).map(([key, entry]) => [key, requireString(entry, `location.${key}`, { allowBlank: true })])
  );
}

function normalizeContact(value: unknown): Record<string, string> {
  const contact = requireObject(value, 'contact');
  assertAllowedKeys(contact, new Set(['email', 'phone']), 'contact');
  const normalized: Record<string, string> = {};
  if ('email' in contact) {
    const email = requireString(contact.email, 'contact.email', { allowBlank: true });
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ErrorUtil('contact.email must be a valid email address.', 422);
      }
      normalized.email = email.toLowerCase();
    }
  }
  if ('phone' in contact) {
    const phone = requireString(contact.phone, 'contact.phone', { allowBlank: true });
    if (phone) {
      normalized.phone = phone;
    }
  }
  return normalized;
}

export function validateManagedResumeSectionBody(
  section: ManagedResumeSection,
  value: unknown,
  athleteId: string,
  operation: 'create' | 'update'
): ValidatedManagedResumeBody {
  const body = requireObject(value, 'Request body');
  assertAllowedKeys(body, SECTION_FIELDS[section], 'Request body');
  validateManagedOwner(body.owner, athleteId);

  let resumeId: string | undefined;
  if (operation === 'create') {
    resumeId = validatePathObjectId(body.resumeId, 'resumeId');
  } else if (body.resumeId !== undefined) {
    resumeId = validatePathObjectId(body.resumeId, 'resumeId');
  }

  if (operation === 'create') {
    for (const field of SECTION_REQUIRED_FIELDS[section]) {
      if (!(field in body)) {
        throw new ErrorUtil(`${field} is required.`, 422);
      }
    }
  }

  const patch: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(body)) {
    if (key === 'owner' || key === 'resumeId') {
      continue;
    }
    switch (key) {
      case 'orgName':
      case 'school':
      case 'title':
      case 'name':
        patch[key] = requireString(entry, key);
        break;
      case 'league':
      case 'position':
      case 'degreeOrProgram':
      case 'notes':
      case 'org':
      case 'description':
      case 'role':
      case 'organization':
      case 'label':
        patch[key] = optionalString(entry, key);
        break;
      case 'level': {
        const level = requireString(entry, 'level', { allowBlank: true });
        if (!level) {
          break;
        }
        if (!EXPERIENCE_LEVELS.has(level)) {
          throw new ErrorUtil(`level must be one of: ${Array.from(EXPERIENCE_LEVELS).join(', ')}.`, 422);
        }
        patch.level = level;
        break;
      }
      case 'location':
        patch.location = normalizeLocation(entry);
        break;
      case 'startDate':
        {
          const startDate = validateDate(entry, 'startDate');
          if (startDate !== undefined) {
            patch.startDate = startDate;
          }
        }
        break;
      case 'endDate':
        patch.endDate = validateDate(entry, 'endDate', true);
        break;
      case 'achievements':
        patch.achievements = stringArray(entry, 'achievements');
        break;
      case 'stats':
        patch.stats = numericOrStringMap(entry, 'stats');
        break;
      case 'isCurrent':
        if (typeof entry !== 'boolean') {
          throw new ErrorUtil('isCurrent must be a boolean.', 422);
        }
        if (entry) {
          patch.endDate = null;
        }
        break;
      case 'year':
        patch.year = integer(entry, 'year', 0);
        break;
      case 'contact':
        patch.contact = normalizeContact(entry);
        break;
      case 'kind': {
        const kind = requireString(entry, 'kind');
        if (!MEDIA_KINDS.has(kind)) {
          throw new ErrorUtil('kind must be video, image, or link.', 422);
        }
        patch.kind = kind;
        break;
      }
      case 'url':
        patch.url = validateUrl(entry, 'url');
        break;
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new ErrorUtil('At least one resume item field is required.', 422);
  }

  return {
    resumeId,
    patch,
    changedFields: Object.keys(body).filter((key) => key !== 'owner' && key !== 'resumeId'),
  };
}
