import crypto from 'crypto';
import { AuthActivityTracker } from '../AuthActivityTracker';
import AuthActivityLog from '../../model/AuthActivityLog';

jest.mock('../../model/AuthActivityLog', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
  },
}));

const mockedFindOneAndUpdate = AuthActivityLog.findOneAndUpdate as jest.Mock;

const buildReq = (overrides: Record<string, any> = {}) =>
  ({
    user: {
      _id: '507f1f77bcf86cd799439011',
      role: ['athlete'],
      profileRefs: {
        athlete: 'athlete-profile-id',
      },
    },
    headers: {
      'x-session-id': 'session-1',
      'user-agent': 'jest-agent',
      'x-forwarded-for': '127.0.0.1',
    },
    method: 'GET',
    baseUrl: '/api/v1/auth',
    path: '/me',
    ip: '127.0.0.1',
    ...overrides,
  }) as any;

describe('AuthActivityTracker', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-26T12:15:00.000Z'));
    jest.clearAllMocks();
    mockedFindOneAndUpdate.mockResolvedValue({});
    AuthActivityTracker.resetForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records only once for the same user, session, and hour', () => {
    const req = buildReq();

    AuthActivityTracker.trackJwtActivity(req, 'jwt-token');
    AuthActivityTracker.trackJwtActivity(req, 'jwt-token');

    expect(mockedFindOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('records again for the same session in a new hour bucket', () => {
    const req = buildReq();

    AuthActivityTracker.trackJwtActivity(req, 'jwt-token');
    jest.setSystemTime(new Date('2026-05-26T13:00:00.000Z'));
    AuthActivityTracker.trackJwtActivity(req, 'jwt-token');

    expect(mockedFindOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('records different session ids separately', () => {
    AuthActivityTracker.trackJwtActivity(buildReq(), 'jwt-token');
    AuthActivityTracker.trackJwtActivity(
      buildReq({
        headers: {
          'x-session-id': 'session-2',
        },
      }),
      'jwt-token'
    );

    expect(mockedFindOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('uses a hashed JWT fallback when x-session-id is absent', () => {
    const token = 'jwt-token';
    const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

    AuthActivityTracker.trackJwtActivity(
      buildReq({
        headers: {},
      }),
      token
    );

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHash: expectedHash,
      }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          sessionHash: expectedHash,
          sessionSource: 'jwt',
        }),
      }),
      expect.any(Object)
    );
  });

  it('skips auth activity analytics routes', () => {
    AuthActivityTracker.trackJwtActivity(
      buildReq({
        baseUrl: '/api/v1/auth/analytics/activity',
        path: '/summary',
      }),
      'jwt-token'
    );

    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
