import mongoose from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export const SCOUT_FEATURE_ID = new mongoose.Types.ObjectId('6a7cbdf79569cccf8b0bb855');
export const STORAGE_LIMIT = 5 * 1024 ** 3;
export const FILE_LIMIT = 25 * 1024 ** 2;
export const FILE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.pdf': 'application/pdf',
};
export function fail(message: string, status = 400): never { throw new ErrorUtil(message, status); }
export function actorId(value: unknown): string {
  const userId = String(value ?? '');
  if (!/^[a-f\d]{24}$/i.test(userId)) fail('A user session is required', 401);
  return userId;
}
export function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail('Invalid resource ID');
  return value;
}
export function text(value: unknown, name: string, max = 10000, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Invalid ${name}`);
  return value.trim();
}
export function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail('A non-negative revision is required');
  return value as number;
}
export function pagination(query: any) {
  const page = Number(query.pageNumber ?? 1), limit = Number(query.pageLimit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !Number.isSafeInteger(page * limit)) fail('Invalid pagination');
  return { page, limit };
}
export function paged(payload: unknown[], totalCount: number, page: number, limit: number) {
  const pages = Math.ceil(totalCount / limit);
  return { payload, metadata: { page, pages, totalCount, prevPage: page > 1 ? page - 1 : null, nextPage: page < pages ? page + 1 : null } };
}
export function itemInput(data: any) {
  if (!['video', 'image', 'pdf', 'text'].includes(data.kind)) fail('Invalid item kind');
  const result: any = {
    kind: data.kind, title: text(data.title, 'title', 200, true),
    description: text(data.description ?? '', 'description'), order: data.order ?? 0,
  };
  if (!Number.isSafeInteger(result.order) || result.order < 0) fail('Invalid item order');
  if (data.kind === 'text') result.text = text(data.text, 'text', 20000, true);
  if (data.kind === 'video') {
    const raw = text(data.url, 'video URL', 2048, true);
    let parsed: URL;
    try { parsed = new URL(raw); } catch { return fail('Invalid video URL'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail('Video links must use HTTPS without credentials');
    result.url = parsed.href;
    for (const key of ['startSeconds', 'endSeconds']) {
      if (data[key] !== undefined) {
        if (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < 0) fail(`Invalid ${key}`);
        result[key] = data[key];
      }
    }
    if (result.endSeconds !== undefined && result.endSeconds <= (result.startSeconds ?? 0)) fail('End timestamp must follow start');
  }
  if (['image', 'pdf'].includes(data.kind)) result.assetId = id(data.assetId);
  return result;
}
