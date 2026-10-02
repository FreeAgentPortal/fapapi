# External job ingestion

Admins register an organization's Greenhouse or Lever board. The API pulls all jobs exposed by that board, without title, department, sport, or seniority filtering. Jobs become published `JobPost` records and use the existing listing, detail, and recommendation endpoints.

This implementation uses the public [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) and [Lever Postings API](https://github.com/lever/postings-api). Arbitrary career pages, RSS feeds, JSON-LD, and custom HTML scrapers require additional provider adapters; they are not accepted as sources yet.

## Admin API

Paths below are relative to the existing `/jobs` API mount. Use the existing authenticated admin permission flow (`Authorization: Bearer ...` and the admin service context if required by the account). The internal API key does not grant the admin permission.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/sources` | Register a source and attempt its first ingestion immediately |
| GET | `/sources?pageNumber=1&pageLimit=20` | Paginated sources and health; limit 1–100 |
| GET | `/sources/:id` | Source details, schedule, last successful result and last error |
| PATCH | `/sources/:id` | Edit name, organizationName, or enabled |
| POST | `/sources/:id/ingest` | Refresh an enabled source immediately, even if not due |
| POST | `/scheduler/trigger/ingestion` | Process all enabled sources currently due |
| GET | `/scheduler/status` | Existing expiration status plus ingestion scheduler status |

Example source request (replace `example` with an actual board token):

```json
{
  "name": "Example Organization Careers",
  "organizationName": "Example Organization",
  "provider": "greenhouse",
  "url": "https://job-boards.greenhouse.io/example",
  "enabled": true
}
```

For Lever use `"provider": "lever"` and `https://jobs.lever.co/example` or `https://jobs.eu.lever.co/example`. Greenhouse also accepts `https://boards.greenhouse.io/example`. Supply the board root, not an individual job or API endpoint. Query strings/fragments are discarded so they cannot filter the imported board. No provider credentials are needed.

The provider, region, and normalized board token uniquely identify a source. Registering the same board again is rejected by a unique index. Its identity cannot be changed with PATCH; disable it and register a new source when moving to another board. Sources are retained for provenance rather than hard-deleted.

POST returns 201 once the source exists, with `payload` holding the source and a separate `ingestion` result (null when disabled). Check `ingestion.status`: source creation can succeed while a provider request fails. Manual ingestion returns 502 on failure, 409 if disabled/busy, and 404 for an unknown source. Batch ingestion reports each source's outcome; an individual failure does not stop the other sources.

```json
{
  "sourceId": "...",
  "status": "success",
  "fetched": 25,
  "created": 10,
  "updated": 15,
  "closed": 0
}
```

`updated` counts matched existing listings, including unchanged content whose last-seen timestamp was refreshed. A failure during database writes can leave partial upserts; rerunning safely converges on the provider snapshot. Source responses expose `lastCheckedAt`, `lastSuccessfulAt`, `nextRunAt`, `consecutiveFailures`, `lastError`, `lastResult`, and `lockedUntil` while busy. The lease token stays private.

## Refresh and closure

- The existing Jobs scheduler polls every 15 minutes. Each source is due six hours after its last attempted ingestion. First ingestion is immediate when adding an enabled source.
- The root scheduler already skips initialization in development. Source creation and manual ingestion still work there. In production this runs while the API process is running; no Azure resource or external scheduler is provisioned.
- MongoDB leases serialize manual ingestion, scheduled ingestion, and source edits across instances. A crashed worker's lease expires after five minutes. Fetches have a 90-second total budget and 15-second request limits; leases are renewed before write batches.
- A complete, validated snapshot is fetched before writing jobs. Lever pagination must finish, Greenhouse's count must match, and invalid or duplicate job identities fail the pull. Responses are size-limited and HTTP redirects are disabled.
- Upserts use a unique partial index on source ID and external job ID, leaving existing native jobs outside that index. Returning jobs reuse the original record and reopen it.
- The first successful pull missing a published job sets `missingSince`. A later successful pull still missing it at least 48 hours later closes it. Provider failures and incomplete snapshots do not mark jobs missing or close them.
- Disabling a source closes its published external listings immediately and stops future pulls. Enabling it makes it due; the next successful pull republishes current jobs. Source edits return 409 while ingestion is running.
- The current database configuration uses Mongoose's automatic index creation. If a deployment disables auto-indexing, create the declared `JobSource` and `JobPost` indexes before enabling ingestion.

## Portal contract

External jobs include `origin: "external"`, `organizationName`, `applyUrl`, `locationText`, and `source: {sourceId, provider, externalId, sourceUrl}`. `firstSeenAt`/`lastSeenAt` record discovery; Greenhouse's upstream update time is `sourceUpdatedAt`, not a claimed publication date. Unknown employment and location types remain absent. Descriptions are converted to plain text and must be rendered as text, not trusted HTML.

External jobs have no synthetic team profile: `team` may be absent. The portal needs to display `organizationName` when no team is present, use `locationText` when available, show an external-listing label, and send Apply to `applyUrl`. These frontend changes are outside this backend module change.

New native jobs have `origin: "internal"`; treat an absent origin on older jobs as internal. Existing job APIs cannot create or edit ingestion provenance. External listings are provider-managed, and edits go through their source. The standard FAP application endpoint rejects external submissions with a 400 response and `applyUrl`. Use the confirmation route below to record a professional's external application.

### Recording an external application

When the professional answers Yes to the frontend's "Did you apply?" prompt, call the authenticated route:

```http
POST /jobs/applications/:jobId/external
Authorization: Bearer <professional-token>
```

No body is required. Job, applicant, origin, status and confirmation history are set by the server; request body fields are ignored. The route records a `JobApplication` with `origin: "external"`, `status: "submitted"`, and the authenticated user's professional profile. It does not require a team, resume, match score, or communication with the provider. The frontend tracks the visit and asks for confirmation; the backend records the user's answer without verifying the external submission.

The response is 201 for a new record, or 200 when already recorded, with the same payload shape:

```json
{
  "success": true,
  "message": "External application recorded",
  "payload": {
    "applicationId": "...",
    "job": "...",
    "applied": true
  }
}
```

The unique job/applicant index prevents duplicates, including concurrent confirmations. Repeated calls preserve the original status and history. Unknown jobs return 404, malformed IDs and internal jobs return 400, and the existing authentication middleware protects the route. Confirmation is allowed for a closed or expired external listing because the professional may have applied before it closed. Answering No requires no request.

These records automatically participate in existing list/recommendation `applied` annotations, the professional's application list, and application status counts. `GET /jobs/:id` now also returns the requesting professional's `applied` boolean for both origins (false if no application/profile exists). As with internal applications, any existing application counts as applied, including withdrawn/rejected records. Internal submissions continue through `POST /jobs/applications/:jobId`; only internal applications require a team. External confirmations do not publish the internal team-submission event.

Non-admin general listings exclude closed external jobs, while the existing recommendations query continues to require published, unexpired jobs. Team-owned listings remain scoped to their actual team. Admins can inspect closed external jobs through the general listing filters. Ingestion performs no relevance filtering; existing user-selected filters and recommendation matching still apply at read time.

No sources are seeded automatically. Add the actual organization boards through the admin API after deploying the backend and updating the portal to handle the external fields.
