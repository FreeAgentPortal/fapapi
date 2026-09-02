import mongoose from 'mongoose';

const mockResumeLean = jest.fn();
const mockResumeSelect = jest.fn(() => ({ lean: mockResumeLean }));
const mockResumeFindById = jest.fn(() => ({ select: mockResumeSelect }));
const mockCreateIndexes = jest.fn();
const mockExists = jest.fn();
const mockInsertOne = jest.fn();

jest.mock('../../resume/models/ResumeProfile', () => ({
  ResumeProfile: { findById: mockResumeFindById },
}));

jest.mock('../model/ProfileViewModel', () => ({
  ProfileViewModel: {
    createIndexes: mockCreateIndexes,
    exists: mockExists,
    collection: { insertOne: mockInsertOne },
  },
}));

import {
  backfillAthleteViews,
  hashLegacySession,
  LegacyAthleteView,
  transformLegacyAthleteView,
} from '../scripts/backfillAthleteViews';

const now = new Date('2026-09-02T12:00:00.000Z');

const buildLegacyView = (overrides: Partial<LegacyAthleteView> = {}): LegacyAthleteView => ({
  _id: new mongoose.Types.ObjectId(),
  athleteId: new mongoose.Types.ObjectId(),
  viewerId: new mongoose.Types.ObjectId(),
  viewerProfileId: new mongoose.Types.ObjectId(),
  viewerType: 'team',
  sessionId: 'legacy-session',
  createdAt: new Date('2026-08-15T12:00:00.000Z'),
  updatedAt: new Date('2026-08-15T13:00:00.000Z'),
  ...overrides,
});

const cursorFor = (views: LegacyAthleteView[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const view of views) yield view;
  },
});

describe('athlete view backfill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExists.mockResolvedValue(null);
    mockCreateIndexes.mockResolvedValue(undefined);
    mockInsertOne.mockResolvedValue({ acknowledged: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('transforms a supported legacy view and hashes its raw session id', async () => {
    const legacy = buildLegacyView();
    const transformed = await transformLegacyAthleteView(legacy);

    expect(transformed).toEqual(
      expect.objectContaining({
        _id: legacy._id,
        subjectType: 'athlete',
        subjectProfileId: legacy.athleteId,
        viewerUserId: legacy.viewerId,
        viewerProfileId: legacy.viewerProfileId,
        viewerType: 'team',
        sessionHash: hashLegacySession(legacy),
        sessionSource: 'legacy',
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
      })
    );
    expect(transformed?.sessionHash).not.toContain('legacy-session');
  });

  it('resolves a legacy resume viewer to its professional owner profile', async () => {
    const ownerProfileId = new mongoose.Types.ObjectId();
    mockResumeLean.mockResolvedValue({ owner: { kind: 'ProfessionalProfile', ref: ownerProfileId } });

    const transformed = await transformLegacyAthleteView(buildLegacyView({ viewerType: 'resume' }));

    expect(transformed).toEqual(expect.objectContaining({ viewerType: 'professional', viewerProfileId: ownerProfileId }));
  });

  it('dry-runs without writing and reports expired and invalid records', async () => {
    const eligible = buildLegacyView();
    const expired = buildLegacyView({ createdAt: new Date('2026-01-01T00:00:00.000Z') });
    const invalid = buildLegacyView({ viewerType: 'unsupported' });
    jest.spyOn(mongoose.connection, 'collection').mockReturnValue({ find: () => cursorFor([eligible, expired, invalid]) } as any);

    const stats = await backfillAthleteViews(false, now);

    expect(stats).toEqual({ scanned: 3, inserted: 1, duplicate: 0, expired: 1, skipped: 1 });
    expect(mockCreateIndexes).not.toHaveBeenCalled();
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it('recognizes an existing destination record on an idempotent rerun', async () => {
    mockExists.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    jest.spyOn(mongoose.connection, 'collection').mockReturnValue({ find: () => cursorFor([buildLegacyView()]) } as any);

    const stats = await backfillAthleteViews(true, now);

    expect(stats).toEqual({ scanned: 1, inserted: 0, duplicate: 1, expired: 0, skipped: 0 });
    expect(mockCreateIndexes).toHaveBeenCalledTimes(1);
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it('creates indexes and inserts transformed records in apply mode', async () => {
    jest.spyOn(mongoose.connection, 'collection').mockReturnValue({ find: () => cursorFor([buildLegacyView()]) } as any);

    const stats = await backfillAthleteViews(true, now);

    expect(stats.inserted).toBe(1);
    expect(mockCreateIndexes).toHaveBeenCalledTimes(1);
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
  });
});
