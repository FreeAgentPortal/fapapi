import crypto from 'crypto';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import AuthActivityLog from '../model/AuthActivityLog';
import logger from '../../../utils/logger';

type SessionSource = 'header' | 'jwt';

const ACTIVITY_BUCKET_MS = 60 * 60 * 1000;
const MAX_CACHE_KEYS = 50000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

export class AuthActivityTracker {
  private static cache = new Map<string, number>();
  private static lastPrunedAt = 0;

  public static trackJwtActivity(req: AuthenticatedRequest, token: string): void {
    try {
      if (!req.user?._id || AuthActivityTracker.shouldSkipRequest(req)) {
        return;
      }

      const now = new Date();
      const bucketStart = AuthActivityTracker.getBucketStart(now);
      const session = AuthActivityTracker.getSession(req, token);
      const userId = String(req.user._id);
      const cacheKey = `${userId}:${session.sessionHash}:${bucketStart.toISOString()}`;

      AuthActivityTracker.pruneCache(now.getTime());

      const cachedUntil = AuthActivityTracker.cache.get(cacheKey);
      if (cachedUntil && cachedUntil > now.getTime()) {
        return;
      }

      AuthActivityTracker.cache.set(cacheKey, bucketStart.getTime() + ACTIVITY_BUCKET_MS);

      AuthActivityLog.findOneAndUpdate(
        {
          userId: req.user._id,
          sessionHash: session.sessionHash,
          bucketStart,
        },
        {
          $setOnInsert: {
            userId: req.user._id,
            sessionHash: session.sessionHash,
            sessionSource: session.sessionSource,
            bucketStart,
            firstSeenAt: now,
            ipAddress: AuthActivityTracker.getIpAddress(req),
            userAgent: AuthActivityTracker.getFirstHeader(req.headers['user-agent']),
            roles: AuthActivityTracker.getRoles(req),
            profileRefs: req.user.profileRefs || {},
          },
          $set: {
            lastSeenAt: now,
            lastPath: AuthActivityTracker.getPath(req),
            lastMethod: req.method,
            lastServiceName: AuthActivityTracker.getFirstHeader(req.headers['x-service-name']),
          },
          $inc: {
            requestCount: 1,
          },
        },
        {
          upsert: true,
          new: false,
          setDefaultsOnInsert: true,
        }
      ).catch((err: any) => {
        logger.error({ err }, '[AuthActivityTracker] Failed to record activity.');
      });
    } catch (err) {
      logger.error({ err }, '[AuthActivityTracker] Failed before activity write.');
    }
  }

  public static resetForTests(): void {
    AuthActivityTracker.cache.clear();
    AuthActivityTracker.lastPrunedAt = 0;
  }

  private static getBucketStart(date: Date): Date {
    const bucketStart = new Date(date);
    bucketStart.setMinutes(0, 0, 0);
    return bucketStart;
  }

  private static getSession(req: AuthenticatedRequest, token: string): { sessionHash: string; sessionSource: SessionSource } {
    const sessionId = AuthActivityTracker.getFirstHeader(req.headers['x-session-id']);
    const sessionSource: SessionSource = sessionId ? 'header' : 'jwt';
    const rawSessionValue = sessionId || token;

    return {
      sessionHash: crypto.createHash('sha256').update(rawSessionValue).digest('hex'),
      sessionSource,
    };
  }

  private static getPath(req: AuthenticatedRequest): string {
    if (req.baseUrl || req.path) {
      return `${req.baseUrl || ''}${req.path || ''}` || '/';
    }

    return req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '/';
  }

  private static getIpAddress(req: AuthenticatedRequest): string {
    const forwardedFor = AuthActivityTracker.getFirstHeader(req.headers['x-forwarded-for']);
    const rawIp = forwardedFor?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '';
    return rawIp.replace(/^::ffff:/, '');
  }

  private static getRoles(req: AuthenticatedRequest): string[] {
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [];
    const requestRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    return Array.from(new Set([...userRoles, ...requestRoles]));
  }

  private static getFirstHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  private static shouldSkipRequest(req: AuthenticatedRequest): boolean {
    const path = AuthActivityTracker.getPath(req);
    return path.includes('/auth/analytics/activity');
  }

  private static pruneCache(now: number): void {
    if (now - AuthActivityTracker.lastPrunedAt < PRUNE_INTERVAL_MS && AuthActivityTracker.cache.size < MAX_CACHE_KEYS) {
      return;
    }

    for (const [key, expiresAt] of AuthActivityTracker.cache.entries()) {
      if (expiresAt <= now) {
        AuthActivityTracker.cache.delete(key);
      }
    }

    if (AuthActivityTracker.cache.size > MAX_CACHE_KEYS) {
      const keysToDrop = AuthActivityTracker.cache.size - MAX_CACHE_KEYS;
      let dropped = 0;
      for (const key of AuthActivityTracker.cache.keys()) {
        AuthActivityTracker.cache.delete(key);
        dropped++;
        if (dropped >= keysToDrop) {
          break;
        }
      }
    }

    AuthActivityTracker.lastPrunedAt = now;
  }
}
