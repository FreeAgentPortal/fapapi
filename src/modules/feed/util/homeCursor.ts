import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export interface HomeCursor {
  version: 1;
  /** Absent on existing sessions, which retain their original placement schedule. */
  cadence?: 'alternating-five';
  userId: string;
  session: string;
  anchor: number;
  expiresAt: number;
  position: number;
  deferredTeam: boolean;
  sponsorIndex: number;
  teamIndex: number;
  last?: { createdAt: string; id: string };
}

export class RestartFeedError extends ErrorUtil {
  constructor() { super('Feed session expired or invalid; refresh the feed', 400); }
}

export function newHomeCursor(userId: string, now = Date.now()): HomeCursor {
  return { version: 1, userId, session: randomBytes(16).toString('hex'), anchor: now, expiresAt: now + 86400000,
    position: 1, deferredTeam: false, sponsorIndex: randomBytes(4).readUInt32BE(), teamIndex: 0 };
}

function signature(body: string): Buffer {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return createHmac('sha256', process.env.JWT_SECRET).update(`home-cursor:v1:${body}`).digest();
}

export function encodeHomeCursor(cursor: HomeCursor): string {
  const body = Buffer.from(JSON.stringify(cursor)).toString('base64url');
  return `${body}.${signature(body).toString('base64url')}`;
}

export function decodeHomeCursor(token: unknown, userId: string, now = Date.now()): HomeCursor {
  try {
    if (typeof token !== 'string' || token.length > 4096) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error();
    const [body, mac] = parts;
    const actual = Buffer.from(mac, 'base64url');
    const expected = signature(body);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const state: HomeCursor = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (state.version !== 1 || (state.cadence !== undefined && state.cadence !== 'alternating-five')
      || state.userId !== userId || !/^[a-f\d]{32}$/.test(state.session)
      || !Number.isSafeInteger(state.anchor) || state.anchor > now
      || state.expiresAt !== state.anchor + 86400000 || state.expiresAt <= now
      || !Number.isSafeInteger(state.position) || state.position < 1
      || typeof state.deferredTeam !== 'boolean'
      || !Number.isSafeInteger(state.sponsorIndex) || state.sponsorIndex < 0
      || !Number.isSafeInteger(state.teamIndex) || state.teamIndex < 0
      || (state.last && (!/^[a-f\d]{24}$/i.test(state.last.id) || !Number.isFinite(Date.parse(state.last.createdAt))))) throw new Error();
    return state;
  } catch { throw new RestartFeedError(); }
}
