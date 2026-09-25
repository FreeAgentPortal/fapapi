import crypto from 'crypto';
import mongoose from 'mongoose';

const mockCreate = jest.fn();
const mockCountDocuments = jest.fn();
const mockAggregate = jest.fn();
const mockExists = jest.fn();
const mockTargetLean = jest.fn();
const mockTargetSelect = jest.fn(() => ({ lean: mockTargetLean }));
const mockTargetFindOne = jest.fn(() => ({ select: mockTargetSelect }));

jest.mock('../model/ProfileViewModel', () => ({
  ProfileViewModel: {
    create: mockCreate,
    countDocuments: mockCountDocuments,
    aggregate: mockAggregate,
  },
}));

jest.mock('../../../../utils/ModelMap', () => {
  const viewerModel = { exists: mockExists };
  return {
    ModelMap: {
      team: viewerModel,
      athlete: { ...viewerModel, findOne: mockTargetFindOne },
      professional: { ...viewerModel, findOne: mockTargetFindOne },
      agent: viewerModel,
      admin: viewerModel,
      scout_profile: viewerModel,
    },
  };
});

import { ProfileViewHandler } from '../handlers/ProfileViewHandler';

const userId = new mongoose.Types.ObjectId();
const targetOwnerId = new mongoose.Types.ObjectId();
const targetProfileId = new mongoose.Types.ObjectId();
const viewerProfileId = new mongoose.Types.ObjectId();

const buildRequest = (serviceName = 'team', profileRef = 'team') =>
  ({
    user: {
      _id: userId,
      profileRefs: { [profileRef]: viewerProfileId.toString() },
    },
    headers: {
      authorization: 'Bearer secret-jwt',
      'x-service-name': serviceName,
      'x-session-id': 'browser-session',
    },
  }) as any;

describe('ProfileViewHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExists.mockResolvedValue({ _id: viewerProfileId });
    mockTargetLean.mockResolvedValue({ _id: targetProfileId, user: targetOwnerId, userId: targetOwnerId });
    mockCreate.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date('2026-09-02T12:00:00.000Z'),
    });
  });

  it.each([
    ['team', 'team'],
    ['athlete', 'athlete'],
    ['professional', 'professional'],
    ['agent', 'agent'],
    ['admin', 'admin'],
    ['scout_profile', 'scout'],
  ])('accepts and verifies the %s viewer context', async (serviceName, profileRef) => {
    const result = await new ProfileViewHandler().recordView('professional', targetProfileId.toString(), buildRequest(serviceName, profileRef));

    expect(result.counted).toBe(true);
    expect(mockExists).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerType: serviceName === 'scout_profile' ? 'scout' : serviceName,
        viewerProfileId,
      })
    );
  });

  it('hashes the client session id before persistence', async () => {
    await new ProfileViewHandler().recordView('professional', targetProfileId.toString(), buildRequest());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHash: crypto.createHash('sha256').update('browser-session').digest('hex'),
        sessionSource: 'header',
      })
    );
  });

  it('falls back to a bearer-token hash', async () => {
    const req = buildRequest();
    delete req.headers['x-session-id'];

    await new ProfileViewHandler().recordView('professional', targetProfileId.toString(), req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHash: crypto.createHash('sha256').update('secret-jwt').digest('hex'),
        sessionSource: 'jwt',
      })
    );
  });

  it('does not count cross-profile self views', async () => {
    mockTargetLean.mockResolvedValue({ _id: targetProfileId, user: userId });

    const result = await new ProfileViewHandler().recordView('professional', targetProfileId.toString(), buildRequest());

    expect(result).toEqual({ counted: false, reason: 'self_view' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('treats a duplicate-key race as a duplicate session', async () => {
    mockCreate.mockRejectedValue({ code: 11000 });

    const result = await new ProfileViewHandler().recordView('professional', targetProfileId.toString(), buildRequest());

    expect(result).toEqual({ counted: false, reason: 'duplicate_session' });
  });

  it('rejects missing or mismatched viewer profiles', async () => {
    mockExists.mockResolvedValue(null);

    await expect(
      new ProfileViewHandler().recordView('professional', targetProfileId.toString(), buildRequest())
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns aggregate-only, zero-filled daily reporting for the owner', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T18:00:00.000Z'));
    mockCountDocuments.mockResolvedValue(3);
    mockAggregate
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([
        { _id: 'team', count: 2 },
        { _id: 'scout', count: 1 },
      ])
      .mockResolvedValueOnce([
        { _id: '2026-09-01', totalViews: 3, uniqueViewers: 2 },
      ]);

    const result = await new ProfileViewHandler().getReport(
      'professional',
      targetProfileId.toString(),
      targetOwnerId.toString(),
      targetProfileId.toString(),
      3
    );

    expect(result.summary).toEqual({ totalViews: 3, uniqueViewers: 2 });
    expect(result.viewsByType).toEqual({ team: 2, scout: 1, agent: 0, athlete: 0, professional: 0, admin: 0 });
    expect(result.dailyViews).toEqual([
      { date: '2026-08-31', totalViews: 0, uniqueViewers: 0 },
      { date: '2026-09-01', totalViews: 3, uniqueViewers: 2 },
      { date: '2026-09-02', totalViews: 0, uniqueViewers: 0 },
    ]);
    jest.useRealTimers();
  });

  it('rejects reporting by a non-owner', async () => {
    await expect(
      new ProfileViewHandler().getReport('athlete', targetProfileId.toString(), userId.toString(), targetProfileId.toString(), 30)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects reporting when the target is absent from the owner profile refs', async () => {
    await expect(
      new ProfileViewHandler().getReport('professional', targetProfileId.toString(), targetOwnerId.toString(), undefined, 30)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
