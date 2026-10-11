import mongoose from 'mongoose';
import { SponsorFeedMeasurementService, SPONSOR_IMPRESSION_COOLDOWN_MS } from '../SponsorFeedMeasurementService';
import { SponsorFeedService } from '../SponsorFeedService';
import { SponsorFeedEventModel } from '../../models/SponsorFeedEvent';
import { SponsorFeedImpressionStateModel } from '../../models/SponsorFeedImpressionState';
import { issuePlacementToken, PlacementClaim } from '../../utils/placementToken';

const start = new Date('2026-10-10T09:29:59.500Z');
const userId = '0123456789abcdef01234567';
const sponsorId = 'abcdef0123456789abcdef01';
const claim = (placementId: string, overrides: Partial<PlacementClaim> = {}): PlacementClaim => ({
  userId, sponsorId, businessName: 'Sponsor', revision: 1, placementId, issuedAt: Date.now(), ...overrides,
});

describe('rolling sponsor impression cooldown', () => {
  const secret = process.env.JWT_SECRET;
  const service = new SponsorFeedMeasurementService();
  let events: Map<string, any>;
  let states: Map<string, any>;
  let sessions: any[];
  let queue: Promise<void>;
  const eventKey = (placementId: string, type: string) => `${placementId}:${type}`;
  const copy = (map: Map<string, any>) => new Map([...map].map(([key, value]) => [key, { ...value }]));

  beforeAll(() => { process.env.JWT_SECRET = 'cooldown-test-secret'; });
  afterAll(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  beforeEach(() => {
    jest.useFakeTimers({ now: start });
    events = new Map(); states = new Map(); sessions = []; queue = Promise.resolve();
    jest.spyOn(SponsorFeedEventModel, 'init').mockResolvedValue(undefined as any);
    jest.spyOn(SponsorFeedImpressionStateModel, 'init').mockResolvedValue(undefined as any);
    jest.spyOn(mongoose, 'startSession').mockImplementation(async () => {
      const session: any = {
        // Model MongoDB's serialization/rollback contract; this is not a live database test.
        withTransaction: jest.fn(async (callback: (session: any) => Promise<any>): Promise<any> => {
          const previous = queue;
          let release!: () => void;
          queue = new Promise<void>(resolve => { release = resolve; });
          await previous;
          const oldEvents = copy(events); const oldStates = copy(states);
          try { return await callback(session); } catch (error) {
            events = oldEvents; states = oldStates; throw error;
          } finally { release(); }
        }),
        endSession: jest.fn().mockResolvedValue(undefined),
      };
      sessions.push(session);
      return session as any;
    });
    jest.spyOn(SponsorFeedImpressionStateModel, 'findOneAndUpdate').mockImplementation((async (filter: any) => {
      const state = { ...(states.get(filter._id) ?? { lastCountedAt: null, sequence: 0 }) };
      state.sequence += 1; states.set(filter._id, state); return state as any;
    }) as any);
    jest.spyOn(SponsorFeedImpressionStateModel, 'updateOne').mockImplementation((async (filter: any, update: any) => {
      states.set(filter._id, { ...states.get(filter._id), ...update.$set });
      return { matchedCount: 1, modifiedCount: 1 } as any;
    }) as any);
    jest.spyOn(SponsorFeedEventModel, 'findOne').mockImplementation((filter: any) => {
      const query = { sort: jest.fn().mockReturnThis(), session: jest.fn().mockReturnThis(), lean: async () => {
        if (filter.placementId) return events.get(eventKey(filter.placementId, filter.type)) ?? null;
        return [...events.values()].filter(event => event.userId === filter.userId && event.sponsorId === filter.sponsorId
          && event.type === filter.type && event.counted !== false)
          .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0] ?? null;
      } };
      return query as any;
    });
    jest.spyOn(SponsorFeedEventModel, 'updateOne').mockImplementation((async (filter: any, update: any) => {
      const key = eventKey(filter.placementId, filter.type);
      if (events.has(key)) return { upsertedCount: 0 } as any;
      events.set(key, { ...filter, ...update.$setOnInsert });
      return { upsertedCount: 1 } as any;
    }) as any);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('counts one of many concurrent appearances for the same viewer and sponsor', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => service.recordImpression(claim(`session-${i}:5`))));
    expect(results.filter(result => result.recorded)).toHaveLength(1);
    expect([...events.values()].filter(event => event.counted)).toHaveLength(1);
    expect(events.size).toBe(20);
    expect(states.size).toBe(1);
    expect(states.get(`${userId}:${sponsorId}`).lastCountedAt).toEqual(start);
    expect(sessions.every(session => session.endSession.mock.calls.length === 1)).toBe(true);
  });

  it('uses a rolling boundary and suppressed appearances do not extend the cooldown', async () => {
    expect(await service.recordImpression(claim('first'))).toEqual({ recorded: true });
    // Crossing a wall-clock half-hour boundary must not allow a back-to-back impression.
    jest.setSystemTime(start.getTime() + 1000);
    expect(await service.recordImpression(claim('next-half-hour'))).toEqual({ recorded: false });
    jest.setSystemTime(start.getTime() + SPONSOR_IMPRESSION_COOLDOWN_MS - 1);
    expect(await service.recordImpression(claim('one-ms-early'))).toEqual({ recorded: false });
    expect(states.get(`${userId}:${sponsorId}`).lastCountedAt).toEqual(start);
    jest.setSystemTime(start.getTime() + SPONSOR_IMPRESSION_COOLDOWN_MS);
    expect(await service.recordImpression(claim('eligible'))).toEqual({ recorded: true });
    expect([...events.values()].filter(event => event.counted)).toHaveLength(2);
  });

  it('keeps counted and suppressed placements deduplicated after the cooldown', async () => {
    const counted = claim('counted'); const suppressed = claim('suppressed');
    await service.recordImpression(counted); await service.recordImpression(suppressed);
    jest.setSystemTime(start.getTime() + SPONSOR_IMPRESSION_COOLDOWN_MS);
    expect(await service.recordImpression(counted)).toEqual({ recorded: false });
    expect(await service.recordImpression(suppressed)).toEqual({ recorded: false });
    expect(await service.recordImpression(claim('fresh'))).toEqual({ recorded: true });
    expect(events.get(eventKey('suppressed', 'impression')).counted).toBe(false);
  });

  it('spans apps, sessions and creative revisions while keeping other viewers/sponsors independent', async () => {
    expect((await service.recordImpression(claim('player-session:5'))).recorded).toBe(true);
    expect((await service.recordImpression(claim('team-session:15', { revision: 2 }))).recorded).toBe(false);
    expect((await service.recordImpression(claim('admin-session:5'))).recorded).toBe(false);
    expect((await service.recordImpression(claim('other-user:5', { userId: '1123456789abcdef01234567' }))).recorded).toBe(true);
    expect((await service.recordImpression(claim('other-sponsor:5', { sponsorId: 'bbcdef0123456789abcdef01' }))).recorded).toBe(true);
    expect(states.size).toBe(3);
  });

  it('uses historical impressions without a counted field when initializing a viewer/sponsor state', async () => {
    const old = new Date(start.getTime() - 5 * 60 * 1000);
    events.set(eventKey('legacy', 'impression'), { ...claim('legacy'), type: 'impression', receivedAt: old });
    expect(await service.recordImpression(claim('new-session'))).toEqual({ recorded: false });
    expect(states.get(`${userId}:${sponsorId}`).lastCountedAt).toEqual(old);
    expect(SponsorFeedEventModel.findOne).toHaveBeenCalledWith({ userId, sponsorId, type: 'impression', counted: { $ne: false } });
    jest.setSystemTime(old.getTime() + SPONSOR_IMPRESSION_COOLDOWN_MS);
    expect(await service.recordImpression(claim('after-legacy-cooldown'))).toEqual({ recorded: true });
  });

  it('counts clicks independently, including on suppressed placements, and deduplicates their retries', async () => {
    const api = new SponsorFeedService();
    const first = issuePlacementToken(claim('first')); const second = issuePlacementToken(claim('second'));
    expect(await api.recordEvent(first, 'impression', userId)).toEqual({ recorded: true });
    expect(await api.recordEvent(second, 'impression', userId)).toEqual({ recorded: false });
    expect(await api.recordEvent(first, 'click', userId)).toEqual({ recorded: true });
    expect(await api.recordEvent(second, 'click', userId)).toEqual({ recorded: true });
    expect(await api.recordEvent(second, 'click', userId)).toEqual({ recorded: false });
  });

  it('rolls back the event and cooldown together if the state write fails, allowing a safe retry', async () => {
    jest.mocked(SponsorFeedImpressionStateModel.updateOne).mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(service.recordImpression(claim('retry'))).rejects.toThrow('storage unavailable');
    expect(events.size).toBe(0); expect(states.size).toBe(0);
    expect(await service.recordImpression(claim('retry'))).toEqual({ recorded: true });
    const session = sessions[1];
    expect(SponsorFeedEventModel.updateOne).toHaveBeenLastCalledWith({ placementId: 'retry', type: 'impression' },
      { $setOnInsert: expect.objectContaining({ counted: true, receivedAt: start }) }, { upsert: true, session });
    expect(SponsorFeedImpressionStateModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: `${userId}:${sponsorId}` }, { $inc: { sequence: 1 }, $setOnInsert: { lastCountedAt: null } },
      { upsert: true, new: true, session });
    expect(session.withTransaction).toHaveBeenCalledWith(expect.any(Function),
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  });

  it('retries a racing first-state insertion and surfaces persistent storage conflicts', async () => {
    jest.mocked(SponsorFeedImpressionStateModel.findOneAndUpdate).mockRejectedValueOnce({ code: 11000 });
    expect(await service.recordImpression(claim('race'))).toEqual({ recorded: true });
    expect(sessions[0].withTransaction).toHaveBeenCalledTimes(2);
    jest.mocked(SponsorFeedImpressionStateModel.findOneAndUpdate).mockRejectedValue({ code: 11000 });
    await expect(service.recordImpression(claim('persistent-error'))).rejects.toEqual({ code: 11000 });
    expect(sessions[1].withTransaction).toHaveBeenCalledTimes(3);
    expect(sessions[1].endSession).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed, expired and foreign-user tokens before any state access', async () => {
    const api = new SponsorFeedService(); const token = issuePlacementToken(claim('valid'));
    await expect(api.recordEvent('invalid', 'impression', userId)).rejects.toThrow();
    await expect(api.recordEvent(token, 'impression', '1123456789abcdef01234567')).rejects.toThrow();
    jest.setSystemTime(start.getTime() + 86400001);
    await expect(api.recordEvent(token, 'impression', userId)).rejects.toThrow();
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  it('excludes suppressed impressions from reports while retaining legacy attribution and UTC boundaries', async () => {
    const aggregate = jest.spyOn(SponsorFeedEventModel, 'aggregate').mockResolvedValue([
      { totals: [{ impressions: 2, clicks: 1 }], daily: [{ _id: '2026-10-10', impressions: 2, clicks: 1 }], sponsors: [] },
    ]);
    const report = await new SponsorFeedService().report('2026-10-10', '2026-10-10');
    expect(aggregate.mock.calls[0][0]?.[0]).toEqual({ $match: { counted: { $ne: false }, receivedAt: {
      $gte: new Date('2026-10-10T00:00:00Z'), $lt: new Date('2026-10-11T00:00:00Z'),
    } } });
    expect(report.totals).toEqual({ impressions: 2, clicks: 1, ctr: 50 });
    expect(SponsorFeedEventModel.schema.indexes()).toContainEqual([
      { sponsorId: 1, userId: 1, type: 1, receivedAt: -1 }, expect.any(Object),
    ]);
  });
});
