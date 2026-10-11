# Composed home feed

## Contracts

All routes below are relative to `/api/v1` and require authentication. Sponsor management and reporting additionally require the `admin` role.

`GET /feed/home?limit=10&cursor=...` returns:

```json
{
  "success": true,
  "payload": [
    { "kind": "organic", "placementId": "...", "activity": { "_id": "canonical activity id" } },
    { "kind": "team", "placementId": "...", "activity": { "_id": "canonical activity id" } },
    { "kind": "sponsor", "placementId": "...", "sponsor": {
      "_id": "sponsor id", "businessName": "Example", "logo": { "url": "https://..." },
      "feedAd": { "enabled": true, "headline": "...", "body": "...", "image": { "url": "https://...", "altText": "..." }, "ctaLabel": "Learn more", "destinationUrl": "https://...", "revision": 1 },
      "measurementToken": "opaque signed token"
    } }
  ],
  "metadata": { "hasMore": true, "nextCursor": "opaque signed cursor" }
}
```

The example illustrates item shapes, not slot ordering. Activity payloads keep their existing inflated object and interaction data. Use `placementId` for render keys and `activity._id` for existing interaction/detail routes.

The page limit counts final cards (1–50). Cursors expire after 24 hours and are bound to the authenticated user. An invalid or expired cursor returns HTTP 400 with `code: FEED_RESTART_REQUIRED`; discard the old pages and start without a cursor. Ordinary activities sort by descending `(createdAt, _id)` and are bounded by session start time. Custom filtering/search stays on the existing activity API.

New sessions insert one placement every fifth card, alternating sponsor and team: sponsors at 5, 15, 25… and featured team posts at 10, 20, 30…. Four chronological cards separate consecutive placements, so 80% of cards come from the chronological stream when both pools are populated. Signed cursors carry the `alternating-five` cadence across page boundaries. Previously issued cursors without a cadence retain the original sponsor-every-third/team-every-fifth schedule until refresh or expiry, avoiding a schedule change mid-session.

Empty pools fall back to ordinary content without borrowing the other pool's slot or accumulating missed placements. Repeats are allowed; an empty ordinary stream ends the feed immediately. Team candidates are the latest 50 public, nondeleted, nonremoved team posts with activities. Pools are rechecked on each page, so disabling a sponsor or removing a post takes effect on subsequent reads. Rotation is per browsing session, not a global delivery quota.

## Sponsor management

- Existing `/sponsors` CRUD continues to manage business name, logo, website, active status, ordering and optional schedule.
- `GET /sponsors/:id/feed-ad` returns the creative or null.
- `PUT /sponsors/:id/feed-ad` accepts multipart fields `headline` (120 characters), `body` (1000), `ctaLabel` (40), `destinationUrl` (HTTP/HTTPS without credentials), `altText` (300), `enabled` (boolean or its string form), and one optional `image` upload. An image is required for the first creative; omitted fields on updates retain existing values. The creative must be complete even when disabled.
- `DELETE /sponsors/:id/feed-ad` removes the creative and its image. Reporting persists. Creative revisions continue increasing even after removal/recreation.
- Image uploads use PNG/JPEG/WebP, at most 5 MB and 25 megapixels. Creative images live separately from sponsor logos.

## Measurement and reporting

`POST /sponsors/feed-events` accepts `{ "token": "measurementToken", "type": "impression" | "click" }`. Response payload is `{ "recorded": true | false }`; false means this placement/type was already recorded or its impression was suppressed by the cooldown. Tokens expire 24 hours after issue and are user-bound. The unique `(placementId, type)` index protects retries and concurrent submissions. Event acceptance waits for model/index initialization.

An authenticated viewer can contribute at most one counted impression per sponsor in a rolling 30-minute period. The cooldown spans feed sessions, apps, devices, and creative revisions. Another placement can count at exactly 30 minutes after the last counted impression; suppressed views do not extend that period. Clicks remain deduplicated per placement/type. Both counted and suppressed impression decisions are retained, so retrying an old placement after the cooldown cannot turn it into a new impression.

Sponsor-owned viewer/sponsor state serializes impression decisions in a MongoDB transaction with the event write. A failure rolls back both writes. Existing impression history initializes the state on first use, including events without the new `counted` field. This requires the same replica-set transaction support already used by ordinary post interactions. Reports exclude `counted: false` events and include all historical events without that field. Previously counted totals are not rewritten.

The athlete client reports an impression only after 50% visibility for five continuous seconds in a visible tab. Hidden tabs, dropping below threshold, and unmounting reset the timer. CTA clicks open a separate tab immediately. Tracking retries transient failures up to three total attempts using the same token. These are client-observed events; API delivery alone records nothing.

Ordinary post views keep their existing unique viewer/post records. Only an actual new upsert increments the post's view counter, and the record/counter commit together in a transaction. Repeated requests during the first second no longer increment the counter again.

`GET /sponsors/report?from=YYYY-MM-DD&to=YYYY-MM-DD&sponsorId=...` includes both UTC calendar dates, permits up to 366 days, and returns `totals`, `daily`, and `sponsors`, each with `impressions`, `clicks`, and `ctr` (percentage or null with zero impressions). Daily rows contain days with events. Receipt time on the server determines each reporting day. Attribution includes sponsor ID, business name at delivery, and creative revision; source deletion does not delete history. No analytics TTL is configured.

## Integration and rollout

The active frontends live in `fap/freeagentmono`. All existing main feeds (player, team, admin, agents, and professional) use composed placements through `packages/features/src/feed`. The legacy `fapathleteportal` and `freeagentadmin` repositories are not integration targets. My Posts and detail views retain the old activity routes.

Feeds default to a centered single column. Above 700px, users can switch between column and masonry layouts; the choice is stored as `uiPreferences.feed_layout` (`column` or `masonry`) through the existing account update API. Missing or unrecognized preferences use column. Mobile always displays a single column without overwriting the saved desktop preference. Masonry retains the existing 3/2/1 breakpoints and array ordering. Admin management is at `/admin/sponsors`, with untracked creative previews and UTC reports defaulting to the last 30 calendar days.

Deploy backend/indexes first, then admin management, then the remaining feed apps. Existing sponsors have no enabled feed creative and need no data backfill. Check the new event unique index before enabling ads. Cooldown state and its collection are initialized before accepting impressions; no analytics backfill is required. No dependency or environment-variable additions are needed; signing uses domain-separated HMAC with the existing `JWT_SECRET`. Rotating that secret invalidates existing feed cursors and measurement tokens.

Focused verification: `npx jest --runInBand src/modules/feed/services/__tests__ src/modules/feed/handlers/__tests__/PostViewDeduplication.test.ts src/modules/sponsors/services/__tests__`, backend `npm run build`, and `pnpm run build:<app>` for `admin`, `player`, `team`, `agents`, and `professional` in `fap/freeagentmono`. Browser verification should use isolated API fixtures or a nonproduction account/database, covering slot boundaries, expired sessions, 49%/50% visibility, interrupted dwell, hidden tabs, repeat placements, CTA retry deduplication, creative editing and historical reports. Verify column defaults, saved layout on reload and across apps, failed-save rollback, preservation of other account preferences, mobile column enforcement without preference writes, and pagination order when switching layouts.
