import { ErrorUtil } from '../../middleware/ErrorUtil';

export type InterestErrorCode =
  | 'INTEREST_NOT_INCLUDED'
  | 'INTEREST_LIMIT_REACHED'
  | 'TEAM_NOT_ELIGIBLE'
  | 'INTEREST_COOLDOWN'
  | 'INTEREST_FORBIDDEN';

export class InterestError extends ErrorUtil {
  constructor(
    public readonly code: InterestErrorCode,
    message: string,
    statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message, statusCode);
  }
}

