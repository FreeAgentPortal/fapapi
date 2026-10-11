import { composeHomeFeed } from '../HomeFeedComposition';
import { newHomeCursor, encodeHomeCursor, decodeHomeCursor, RestartFeedError } from '../../util/homeCursor';
import { isHomeActivityEligible, HomeFeedCandidates } from '../../handlers/HomeFeedCandidates.handler';
import { ActivityModel } from '../../model/Activity.model';
import { ActivityInflationHandler } from '../../handlers/ActivityInflation.handler';
import { HomeFeedService } from '../HomeFeed.service';

const user = '0123456789abcdef01234567';
const activity = (index: number) => ({ _id: index.toString(16).padStart(24, '0'), createdAt: new Date(100000 - index * 1000), visibility: 'public', objectDetails: { visibility: 'public' } });
const sponsors = [1, 2, 3].map(id => ({ _id: String(id), feedAd: { revision: 1 } }));
const organic = Array.from({ length: 100 }, (_, index) => activity(index + 1));
const teams = [activity(201), activity(202)];

describe('home feed composition', () => {
  const secret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'home-feed-test-secret'; });
  afterAll(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  afterEach(() => jest.restoreAllMocks());

  it('keeps slots, organic continuation, and rotations across changing page sizes', () => {
    let state = newHomeCursor(user);
    state.sponsorIndex = 0;
    const delivered: ReturnType<typeof composeHomeFeed>['items'] = [];
    let consumed = 0;
    for (const size of [2, 1, 7, 5, 1, 14, 1]) {
      const page = composeHomeFeed(state, size, organic.slice(consumed), teams, sponsors);
      consumed += page.items.filter(item => item.kind === 'organic').length;
      delivered.push(...page.items);
      state = decodeHomeCursor(encodeHomeCursor(state), user);
    }
    for (let position = 1; position <= 31; position++) {
      expect(delivered[position - 1].kind).toBe(position % 3 === 0 ? 'sponsor' : position % 5 === 0 || position === 16 || position === 31 ? 'team' : 'organic');
    }
    expect(delivered.filter(item => item.kind === 'organic').map(item => item.kind !== 'sponsor' && item.activity._id)).toEqual(organic.slice(0, consumed).map(item => item._id));
    expect(delivered.filter(item => item.kind === 'sponsor').map(item => item.kind === 'sponsor' && item.sponsor._id)).toEqual(['1', '2', '3', '1', '2', '3', '1', '2', '3', '1']);
    const teamItems = delivered.filter(item => item.kind === 'team');
    expect(teamItems.map(item => item.kind === 'team' && item.activity._id)).toEqual([teams[0]._id, teams[1]._id, teams[0]._id, teams[1]._id, teams[0]._id, teams[1]._id]);
    expect(new Set(delivered.map(item => item.placementId)).size).toBe(delivered.length);
  });

  it('falls back to ordinary posts without accumulating missed placements', () => {
    const state = newHomeCursor(user);
    const first = composeHomeFeed(state, 15, organic, [], []);
    expect(first.items.every(item => item.kind === 'organic')).toBe(true);
    expect(state.deferredTeam).toBe(false);
    expect(composeHomeFeed(state, 1, organic.slice(15), teams, sponsors).items[0].kind).toBe('organic');
  });

  it('uses the team slot on a collision when no ad is eligible', () => {
    const state = newHomeCursor(user); state.position = 15;
    expect(composeHomeFeed(state, 1, organic, teams, []).items[0].kind).toBe('team');
    expect(state.deferredTeam).toBe(false);
  });

  it('stops at exhaustion even with a deferred team or ad due', () => {
    const state = newHomeCursor(user); state.position = 15; state.deferredTeam = true;
    expect(composeHomeFeed(state, 20, [], teams, sponsors)).toEqual({ items: [], hasMore: false });
    const short = composeHomeFeed(newHomeCursor(user), 20, organic.slice(0, 2), teams, sponsors);
    expect(short.items.map(item => item.kind)).toEqual(['organic', 'organic']);
    expect(short.hasMore).toBe(false);
  });

  it('rejects expired, tampered, malformed, and foreign-user cursors', () => {
    const state = newHomeCursor(user, 100000);
    const token = encodeHomeCursor(state);
    expect(decodeHomeCursor(token, user, 100001)).toEqual(state);
    for (const invalid of ['', 'garbage', token + 'x', token.replace('.', '.x.')]) expect(() => decodeHomeCursor(invalid, user, 100001)).toThrow(RestartFeedError);
    expect(() => decodeHomeCursor(token, 'another-user', 100001)).toThrow(RestartFeedError);
    expect(() => decodeHomeCursor(token, user, state.expiresAt)).toThrow(RestartFeedError);
  });

  it.each([
    { visibility: 'private' }, { objectDetails: undefined },
    { objectDetails: { visibility: 'private' } }, { objectDetails: { isDeleted: true } },
    { objectDetails: { moderation: { status: 'removed' } } },
  ])('excludes ineligible activity %j', overrides => {
    expect(isHomeActivityEligible({ ...activity(1), ...overrides })).toBe(false);
  });

  it('anchors candidate reads and scans beyond invalid references using a stable tie breaker', async () => {
    const state = newHomeCursor(user, 200000);
    state.last = { id: activity(1)._id, createdAt: activity(1).createdAt.toISOString() };
    const find = jest.spyOn(ActivityModel, 'find').mockReturnValue({ sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([activity(2), { ...activity(3), objectDetails: undefined }, activity(4)]) } as any);
    jest.spyOn(ActivityInflationHandler.prototype, 'inflateActivityObjects').mockResolvedValue(undefined);
    const result = await new HomeFeedCandidates().organic(state, 2);
    expect(result.map(row => row._id)).toEqual([activity(2)._id, activity(4)._id]);
    expect((find.mock.calls as unknown[][])[0][0]).toMatchObject({ visibility: 'public', createdAt: { $lte: new Date(200000) }, $or: [
      { createdAt: { $lt: activity(1).createdAt } }, { createdAt: activity(1).createdAt, _id: { $lt: expect.anything() } },
    ] });
  });

  it('rechecks sponsor eligibility on every page and rejects invalid limits', async () => {
    const eligible = jest.fn().mockResolvedValueOnce(sponsors).mockResolvedValueOnce([]);
    const service = new HomeFeedService({ organic: jest.fn().mockResolvedValue(organic), teams: jest.fn().mockResolvedValue(teams) } as any,
      { eligible, placement: (sponsor: any) => sponsor } as any, { enrichWithInteractions: jest.fn() } as any);
    const first = await service.fetch(user, '2');
    const second = await service.fetch(user, '1', first.metadata.nextCursor);
    expect(second.payload[0].kind).toBe('organic');
    expect(eligible).toHaveBeenCalledTimes(2);
    for (const invalid of ['0', '51', '-1', '1.5', ['10']]) await expect(service.fetch(user, invalid)).rejects.toThrow('limit');
  });
});
