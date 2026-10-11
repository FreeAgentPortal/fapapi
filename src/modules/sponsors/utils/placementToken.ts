import { createHmac, timingSafeEqual } from 'crypto';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export interface PlacementClaim {
  userId: string;
  sponsorId: string;
  businessName: string;
  revision: number;
  placementId: string;
  issuedAt: number;
}

function signature(body: string): Buffer {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return createHmac('sha256', process.env.JWT_SECRET).update(`sponsor-placement:v1:${body}`).digest();
}

export function issuePlacementToken(claim: PlacementClaim): string {
  const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${body}.${signature(body).toString('base64url')}`;
}

export function readPlacementToken(token: unknown, userId: string, now = Date.now()): PlacementClaim {
  try {
    if (typeof token !== 'string' || token.length > 4096) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error();
    const [body, mac] = parts;
    const actual = Buffer.from(mac, 'base64url');
    const expected = signature(body);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const claim: PlacementClaim = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (claim.userId !== userId || !/^[a-f\d]{24}$/i.test(claim.sponsorId)
      || !Number.isSafeInteger(claim.revision) || claim.revision < 1
      || typeof claim.placementId !== 'string' || !claim.placementId
      || typeof claim.businessName !== 'string' || !Number.isSafeInteger(claim.issuedAt)
      || claim.issuedAt > now || now - claim.issuedAt > 86400000) throw new Error();
    return claim;
  } catch {
    throw new ErrorUtil('Invalid or expired sponsor placement token', 400);
  }
}
