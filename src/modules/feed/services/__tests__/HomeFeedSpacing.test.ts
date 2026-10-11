import { composeHomeFeed } from '../HomeFeedComposition';
import { HomeFeedService } from '../HomeFeed.service';
import { decodeHomeCursor, encodeHomeCursor, HomeCursor, newHomeCursor, RestartFeedError } from '../../util/homeCursor';

const user = '0123456789abcdef01234567';
const activity = (n: number) => ({ _id: n.toString(16).padStart(24, '0'), createdAt: new Date(1000000 - n * 1000) });
const organic = Array.from({ length: 100 }, (_, index) => activity(index + 1));
const teams = [activity(201), activity(202)];
const sponsors = [1, 2, 3].map(id => ({ _id: String(id), feedAd: { revision: 1 } }));
const spacedCursor = (): HomeCursor => ({ ...newHomeCursor(user), cadence: 'alternating-five', sponsorIndex: 0 });

describe('lower-density home feed', () => {
  const secret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'feed-spacing-test-secret'; });
  afterAll(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });

  it('keeps four chronological cards between alternating placements across varied page boundaries', () => {
    let state = spacedCursor();
    let consumed = 0;
    const delivered: ReturnType<typeof composeHomeFeed>['items'] = [];
    for (const size of [4, 1, 4, 1, 5, 1, 14, 1, 19]) {
      const result = composeHomeFeed(state, size, organic.slice(consumed), teams, sponsors);
      consumed += result.items.filter(item => item.kind === 'organic').length;
      delivered.push(...result.items);
      state = decodeHomeCursor(encodeHomeCursor(state), user);
    }
    expect(delivered).toHaveLength(50);
    expect(delivered.map(item => item.kind)).toEqual(Array.from({ length: 50 }, (_, index) => {
      const position = index + 1;
      return position % 10 === 5 ? 'sponsor' : position % 10 === 0 ? 'team' : 'organic';
    }));
    expect(consumed).toBe(40);
    expect(delivered.filter(item => item.kind === 'organic').map(item => item.kind !== 'sponsor' && item.activity._id))
      .toEqual(organic.slice(0, 40).map(item => item._id));
    expect(delivered.filter(item => item.kind === 'sponsor').map(item => item.kind === 'sponsor' && item.sponsor._id))
      .toEqual(['1', '2', '3', '1', '2']);
    expect(delivered.filter(item => item.kind === 'team').map(item => item.kind === 'team' && item.activity._id))
      .toEqual([teams[0]._id, teams[1]._id, teams[0]._id, teams[1]._id, teams[0]._id]);
    expect(new Set(delivered.map(item => item.placementId)).size).toBe(50);
  });

  it.each([['both', [], []], ['sponsors', teams, []], ['teams', [], sponsors]])(
    'fills missing %s with chronological content without promoting the other pool', (_label, teamPool, sponsorPool) => {
      const state = spacedCursor();
      const result = composeHomeFeed(state, 10, organic, teamPool, sponsorPool);
      expect(result.items[4].kind).toBe(sponsorPool.length ? 'sponsor' : 'organic');
      expect(result.items[9].kind).toBe(teamPool.length ? 'team' : 'organic');
      expect(state.deferredTeam).toBe(false);
      expect(composeHomeFeed(state, 1, organic.slice(10), teams, sponsors).items[0].kind).toBe('organic');
    },
  );

  it('never emits placements without remaining chronological content', () => {
    const state = spacedCursor();
    const short = composeHomeFeed(state, 50, organic.slice(0, 4), teams, sponsors);
    expect(short.items.map(item => item.kind)).toEqual(['organic', 'organic', 'organic', 'organic']);
    expect(short.hasMore).toBe(false);
    expect(composeHomeFeed(state, 50, [], teams, sponsors)).toEqual({ items: [], hasMore: false });
  });

  it('uses the new cadence for API sessions while preserving already-issued cursors', async () => {
    const service = new HomeFeedService(
      { organic: jest.fn().mockResolvedValue(organic), teams: jest.fn().mockResolvedValue(teams) } as any,
      { eligible: jest.fn().mockResolvedValue(sponsors), placement: (sponsor: any) => sponsor } as any,
      { enrichWithInteractions: jest.fn() } as any,
    );
    const first = await service.fetch(user, '4');
    expect(first.payload.every(item => item.kind === 'organic')).toBe(true);
    expect(decodeHomeCursor(first.metadata.nextCursor, user).cadence).toBe('alternating-five');
    const next = await service.fetch(user, '6', first.metadata.nextCursor);
    expect(next.payload.map(item => item.kind)).toEqual(['sponsor', 'organic', 'organic', 'organic', 'organic', 'team']);

    const legacy = newHomeCursor(user);
    legacy.position = 3;
    const resumed = await service.fetch(user, '1', encodeHomeCursor(legacy));
    expect(resumed.payload[0].kind).toBe('sponsor');
    expect(decodeHomeCursor(resumed.metadata.nextCursor, user).cadence).toBeUndefined();
  });

  it('rejects unsupported cadence values even with a valid signature', () => {
    const invalid = { ...spacedCursor(), cadence: 'unknown' } as unknown as HomeCursor;
    expect(() => decodeHomeCursor(encodeHomeCursor(invalid), user)).toThrow(RestartFeedError);
  });
});
