import { HomeCursor } from '../util/homeCursor';

export type HomeFeedItem =
  | { kind: 'organic' | 'team'; placementId: string; activity: any }
  | { kind: 'sponsor'; placementId: string; sponsor: any };

/** Pure slot scheduler. The caller supplies at least limit + 1 organic candidates. */
export function composeHomeFeed(state: HomeCursor, limit: number, organic: any[], teams: any[], sponsors: any[]) {
  const items: HomeFeedItem[] = [];
  let consumed = 0;
  while (items.length < limit && consumed < organic.length) {
    const position = state.position++;
    // New sessions leave four ordinary cards between placements and alternate pools.
    // Keep the original scheduler for already-issued cursors until refresh/expiry.
    const spaced = state.cadence === 'alternating-five';
    const adDue = spaced ? position % 10 === 5 : position % 3 === 0;
    const teamDue = spaced ? position % 10 === 0 : position % 5 === 0 || state.deferredTeam;
    state.deferredTeam = false;
    const base = `${state.session}:${position}`;
    if (adDue && sponsors.length) {
      const sponsor = sponsors[state.sponsorIndex++ % sponsors.length];
      items.push({ kind: 'sponsor', placementId: `${base}:sponsor:${sponsor._id}:${sponsor.feedAd.revision}`, sponsor });
      state.deferredTeam = teamDue && teams.length > 0;
    } else if (teamDue && teams.length) {
      const activity = teams[state.teamIndex++ % teams.length];
      items.push({ kind: 'team', placementId: `${base}:team:${activity._id}`, activity });
    } else {
      const activity = organic[consumed++];
      items.push({ kind: 'organic', placementId: `${base}:organic:${activity._id}`, activity });
      state.last = { createdAt: new Date(activity.createdAt).toISOString(), id: String(activity._id) };
    }
  }
  return { items, hasMore: consumed < organic.length };
}
