import { SponsorFeedService } from '../../sponsors/services/SponsorFeedService';
import { HomeFeedCandidates } from '../handlers/HomeFeedCandidates.handler';
import { ActivityEnrichmentHandler } from '../handlers/ActivityEnrichment.handler';
import { decodeHomeCursor, encodeHomeCursor, newHomeCursor, HomeCursor } from '../util/homeCursor';
import { composeHomeFeed } from './HomeFeedComposition';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

export class HomeFeedService {
  constructor(private candidates = new HomeFeedCandidates(), private sponsors = new SponsorFeedService(),
    private enrichment = new ActivityEnrichmentHandler()) {}

  async fetch(userId: string, requestedLimit: unknown, token?: unknown) {
    const limit = requestedLimit === undefined ? 10 : typeof requestedLimit === 'string' && /^\d+$/.test(requestedLimit) ? Number(requestedLimit) : NaN;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new ErrorUtil('limit must be an integer between 1 and 50', 400);
    const state: HomeCursor = token === undefined
      ? { ...newHomeCursor(userId), cadence: 'alternating-five' }
      : decodeHomeCursor(token, userId);
    const [organic, teams, sponsors] = await Promise.all([
      this.candidates.organic(state, limit + 1), this.candidates.teams(state.anchor), this.sponsors.eligible(),
    ]);
    const result = composeHomeFeed(state, limit, organic, teams, sponsors);
    const activities = [...new Map(result.items.flatMap(item => item.kind === 'sponsor' ? [] : [[String(item.activity._id), item.activity] as const])).values()];
    await this.enrichment.enrichWithInteractions(activities, userId);
    const byId = new Map(activities.map(activity => [String(activity._id), activity]));
    const payload = result.items.map(item => item.kind === 'sponsor'
      ? { ...item, sponsor: this.sponsors.placement(item.sponsor, userId, item.placementId) }
      : { ...item, activity: byId.get(String(item.activity._id)) });
    return { success: true, payload, metadata: { hasMore: result.hasMore, nextCursor: result.hasMore ? encodeHomeCursor(state) : null } };
  }
}
