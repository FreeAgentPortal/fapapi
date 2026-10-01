import { ErrorUtil } from '../../../middleware/ErrorUtil';

const editableFields = ['businessName', 'websiteUrl', 'isActive', 'displayOrder', 'startsAt', 'endsAt', 'altText'];

/** Accept JSON and multipart field values without allowing writes to asset or audit fields. */
export function parseSponsorInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ErrorUtil('Sponsor fields must be an object', 400);
  }

  const fields: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!editableFields.includes(key)) {
      throw new ErrorUtil(`Sponsor field cannot be set: ${key}`, 400);
    }
    let value = raw;
    if (['websiteUrl', 'startsAt', 'endsAt'].includes(key) && value === '') value = null;

    if (key === 'isActive') {
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      if (typeof value !== 'boolean') throw new ErrorUtil('isActive must be a boolean', 400);
    } else if (key === 'displayOrder') {
      if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new ErrorUtil('displayOrder must be a nonnegative integer', 400);
      }
    } else if (key === 'startsAt' || key === 'endsAt') {
      if (value !== null && typeof value !== 'string') throw new ErrorUtil(`${key} must be a date string or null`, 400);
    } else if (typeof value !== 'string' && !(key === 'websiteUrl' && value === null)) {
      throw new ErrorUtil(`${key} must be a string`, 400);
    }
    fields[key] = value;
  }
  return fields;
}
