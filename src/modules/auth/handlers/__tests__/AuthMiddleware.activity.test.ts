const mockJwtVerify = jest.fn();
const mockUserFindById = jest.fn();
const mockTrackJwtActivity = jest.fn();

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    verify: mockJwtVerify,
  },
  verify: mockJwtVerify,
}));

jest.mock('../../model/User', () => ({
  __esModule: true,
  default: {
    findById: mockUserFindById,
  },
}));

jest.mock('../AuthActivityTracker', () => ({
  AuthActivityTracker: {
    trackJwtActivity: mockTrackJwtActivity,
  },
}));

import { AuthMiddleware } from '../../../../middleware/AuthMiddleware';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const buildResponse = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as any;

const buildJwtRequest = () =>
  ({
    headers: {
      authorization: 'Bearer jwt-token',
    },
  }) as any;

describe('AuthMiddleware activity tracking', () => {
  const originalInternalApiKey = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.INTERNAL_API_KEY = 'internal-key';
    mockJwtVerify.mockReturnValue({ userId: '507f1f77bcf86cd799439011' });
    mockUserFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        role: ['athlete'],
        profileRefs: {},
        permissions: [],
      }),
    });
  });

  afterAll(() => {
    process.env.INTERNAL_API_KEY = originalInternalApiKey;
  });

  it('schedules activity tracking for successful JWT auth', async () => {
    const req = buildJwtRequest();
    const res = buildResponse();
    const next = jest.fn();

    AuthMiddleware.protect(req, res, next);
    await flushPromises();

    expect(mockTrackJwtActivity).toHaveBeenCalledWith(req, 'jwt-token');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not track invalid JWT requests', async () => {
    mockJwtVerify.mockImplementationOnce(() => {
      throw new Error('invalid token');
    });
    const res = buildResponse();
    const next = jest.fn();

    AuthMiddleware.protect(buildJwtRequest(), res, next);
    await flushPromises();

    expect(mockTrackJwtActivity).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('does not track API key auth requests', async () => {
    const req = {
      headers: {
        authorization: 'ApiKey internal-key',
      },
    } as any;
    const res = buildResponse();
    const next = jest.fn();

    AuthMiddleware.protect(req, res, next);
    await flushPromises();

    expect(mockTrackJwtActivity).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not block auth when activity tracking throws synchronously', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockTrackJwtActivity.mockImplementationOnce(() => {
      throw new Error('tracking failed');
    });
    const res = buildResponse();
    const next = jest.fn();

    AuthMiddleware.protect(buildJwtRequest(), res, next);
    await flushPromises();

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
