import { Request } from 'express';
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';

export const TALENT_SEARCH_RATE_LIMIT = 60;
export const TALENT_SEARCH_RATE_WINDOW_MS = 60_000;

export const createTalentSearchRateLimiter = (
  limit: number = TALENT_SEARCH_RATE_LIMIT,
  windowMs: number = TALENT_SEARCH_RATE_WINDOW_MS
): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    limit,
    identifier: 'professional-talent-search',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const user = (req as AuthenticatedRequest).user;
      return String(user?._id ?? (user as any)?.userId);
    },
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        message: 'Too many talent search requests. Please try again later.',
      }),
  });

const talentSearchRateLimiter = createTalentSearchRateLimiter();

export default talentSearchRateLimiter;
