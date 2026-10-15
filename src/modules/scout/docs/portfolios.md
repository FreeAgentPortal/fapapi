# Athlete portfolios and independent scout evaluations

## Behavior

An eligible athlete edits one private draft and explicitly publishes immutable numbered submissions. The latest version appears in the scouting queue until withdrawal or loss of scouting access. Previous reports do not exclude the athlete. Multiple scouts review independently; each scout gets one review and at most one report per version.

Starting a review removes that version from that scout's available queue. Reviews live in the scout's in-progress/history lists. Publishing another version allows new reviews against it, while already-started reviews may finish against their original snapshot. A withdrawal cancels all unfinished reviews; already-submitted reports remain pending for admin decision. Publishing after withdrawal requires a draft change. Retries of submit, start, decline, report submission, and matching admin decisions are idempotent.

Scouts may explain missing information or mark an item unusable, but these judgments never block another scout. Feedback becomes visible to the athlete on report submission or decline. There is no mandatory response, appeal, assignment, claim, or direct-message workflow. Reports are readable by the athlete only after approval. Other scouts cannot read another review's drafts or feedback. Approved public reports retain scout visibility; submitted portfolios are never public.

Loss of entitlement blocks draft editing, uploads, publishing and new reviews, while preserving athlete history and already-started reviews. Effective access means an active athlete/user, latest billing record in active/trialing status, no needsUpdate flag, and feature 6a7cbdf79569cccf8b0bb855 in billing.features. Only an absent legacy features field falls back to plan.features; an empty array explicitly grants nothing. Cancellation scheduled for the future does not remove currently active access.

Scouts need an active profile and the existing scout.reports permissions. New reviews and their writes require scout.reports.create; review reads require scout.reports.view. Report approval requires a persisted Admin profile with the admin role. Actor/owner IDs, approval state, finalized state, snapshot version, and rating totals are server-owned. Scouts cannot evaluate themselves.

## API conventions

All endpoints require a user Bearer token. Internal API keys without a user identity are not portfolio actors. New endpoints return `{ success: true, payload: ... }`. Paginated values use `{ payload: [...], metadata: { page, pages, totalCount, prevPage, nextPage } }` inside that envelope, unless noted below. Pagination parameters are pageNumber (default 1) and pageLimit (default 20, maximum 50).

Draft writes require the current portfolio `revision`; review writes require their own review `revision`. Send numeric revisions. A stale revision returns 409: reload, reconcile the user's changes, then retry. Item PUT replaces the whole item, not a partial patch. Item arrays, submitted items and item feedback are separately paginated.

Expected errors: 400 invalid input, 401 missing/invalid authentication, 403 access denied, 404 missing/inaccessible record, 409 stale revision/closed workflow/quota conflict, 413 oversized binary request, 429 upload rate/pending-upload limit, 502/503 storage failure, failed upload verification or missing storage configuration.

### Athlete draft and submissions

Base: `/api/v1/scout`

| Method and path | Input / result |
| --- | --- |
| GET /portfolio | `{ portfolio, canEdit, items: paginatedItems }`; an absent draft returns revision/version 0 |
| PATCH /portfolio | `{ revision, sport?, position?, context? }`; updated portfolio |
| POST /portfolio/items | Full item plus revision; `{ item, revision }` |
| PUT /portfolio/items/:itemId | Full replacement item plus revision; `{ item, revision }` |
| DELETE /portfolio/items/:itemId | JSON `{ revision }`; new revision |
| POST /portfolio/submit | `{ revision }`; immutable submission, including version and submittedAt |
| POST /portfolio/withdraw | No body required; withdrawn portfolio |
| GET /portfolio/submissions | Athlete's paginated submission history |
| GET /submissions/:submissionId | `{ submission, items: paginatedItems }`; authorized snapshot |
| GET /submissions/:submissionId/items/:itemId | One immutable item, using the original itemId; same submission authorization |
| GET /submissions/:submissionId/feedback | Paginated completed reviews, athlete/admin only |

Publication requires nonblank sport, position, context, and at least one HTTPS video link. Required portfolio context describes what the athlete wants evaluated. Submitted athlete details include name, league, school, graduation year, measurements and metrics. Later profile/draft edits never change these snapshots.

Item examples (supply the latest revision on every write):

```json
{
  "revision": 2,
  "kind": "video",
  "title": "Full game — September 12",
  "description": "Evaluate release and pocket movement",
  "url": "https://example.com/game",
  "startSeconds": 45,
  "endSeconds": 120,
  "order": 0
}
```

Other kinds: `text` requires `text`; `image` and `pdf` require a completed, owned `assetId`. All require a title and support description/order. Limits: title 200 characters, description 10,000, text 20,000, context 10,000, video URL 2,048. Order is a nonnegative integer. End timestamp must follow start. External links are never fetched by the server: the version preserves the URL and timestamps, not externally hosted footage. No item-count cap is imposed.

### Scout queue and reviews

| Method and path | Input / result |
| --- | --- |
| GET /api/v1/profiles/scout/scouting-queue | Existing top-level `{ success, payload, metadata }` envelope; latest eligible submissions this scout has not reviewed |
| POST /api/v1/scout/submissions/:submissionId/reviews | Start/return this scout's review |
| GET /api/v1/scout/reviews?state=in_progress | Paginated owned in-progress reviews |
| GET /api/v1/scout/reviews?state=completed | Owned submitted, declined and cancelled reviews |
| GET /api/v1/scout/reviews/:reviewId | `{ review, itemFeedback: paginatedItems }` |
| PATCH /api/v1/scout/reviews/:reviewId | `{ revision, feedback }` |
| PUT /api/v1/scout/reviews/:reviewId/items/:itemId | `{ revision, comment, unusable, reason }`; reason required when unusable |
| GET /api/v1/scout/reviews/:reviewId/items/:itemId | Saved item feedback or null; same review authorization, validates submission membership |
| POST /api/v1/scout/reviews/:reviewId/decline | `{ revision, feedback?, reason }`; reason required |
| POST /api/v1/scout/reviews/:reviewId/report | `{ revision, feedback?, report: { ratingBreakdown, observations?, ... } }` |

Queue cards retain athlete `_id`, fullName, sport, league, profileImageUrl, diamondRating, needsScouting and scoutingPriority. They add athleteId, submissionId, version, position, context, itemCount, submittedAt and reviewerStatus=available. Queue order is oldest submitted version first. The old free-athlete discovery and billing-plan display are removed; clients should use submissionId to open the evidence.

The itemId in feedback refers to the original itemId carried by the submitted item, not that snapshot row's `_id`. Existing review access survives entitlement loss or superseding versions. Cancelled reviews do not grant access to withdrawn snapshots. Completed reviews remain historical records. A report submission may include the existing observations, strengths, weaknesses, verifiedMetrics, unverifiedMetrics, recommendations, tags, isPublic and league fields. Sport, athlete, scout, reportType=evaluation and submission references come from the review. A missing league uses the captured athlete league, otherwise `unspecified`.

```json
{
  "revision": 1,
  "feedback": "Good mechanics; longer game footage would help assess consistency.",
  "report": {
    "ratingBreakdown": {
      "accuracy": { "score": 4, "comments": "Consistent placement" },
      "mechanics": { "score": 4 },
      "decisionMaking": { "score": 3 }
    },
    "observations": "Assessment based on submitted footage.",
    "isPublic": false
  }
}
```

No item citations are required. The backend requires at least three numeric categories in the range 1–5 before report submission/approval. A submitted portfolio report cannot be edited through generic report CRUD.

### Existing report API

`GET/POST /api/v1/scout`, `GET/PUT/DELETE /api/v1/scout/:id`, and `POST /api/v1/scout/:id/handle` remain available. List filtering and pagination remain supported, constrained by server-enforced visibility. Athletes see their approved reports; scouts see their own and approved public reports; administrators see all. Details never disclose unapproved reports to athletes.

Filters/sorts accept report identifiers, sport, league, reportType, status, draft/finalized/public flags, tags, diamondRating, createdAt, updatedAt, athlete.name and scout.name. Query options must be strings. Operator-like field names are rejected, and keyword searches treat input as literal text. Existing hydrated athlete/scout list cards are retained.

Standalone creation remains available for existing non-portfolio workflows. It cannot set submission/review links or impersonate a scout. Only the creating scout may edit/delete an unsubmitted standalone draft, using the corresponding existing permission. Set isDraft=false to submit a complete standalone draft. Finalized/submitted reports cannot be changed or deleted through generic CRUD. The admin decision body remains `{ action: "approve" | "deny", message?: string }`; drafts cannot be processed. Mutation responses now include the resource under payload.

The athlete rating is the arithmetic mean of every approved finalized non-portfolio report plus each scout's latest approved portfolio report. Latest is determined by submissionVersion, independent of approval order. A pending/denied replacement leaves the previous contribution intact. Invalid historical rating values are excluded. Empty qualifying sets clear diamondRating. Existing ScoutReport.scoutId values remain ScoutProfile IDs; the schema reference is corrected to reflect the existing writer/lookup behavior.

### Files

Base: `/api/v1/upload/scout-portfolio`

| Method and path | Input / result |
| --- | --- |
| GET /assets | Athlete's paginated assets, excluding storage keys |
| POST /assets | `{ fileName, contentType, bytes }`; returns assetId, uploadPath, expiresAt |
| PUT /assets/:assetId/content | Raw bytes with Content-Type: application/octet-stream; returns completed assetId/state |
| GET /assets/:assetId/download | Athlete-owned file; returns signed URL and expiresInSeconds=300 |
| GET /assets/:assetId/download?submissionId=... | Authorized submitted file, including scout/admin access |
| DELETE /assets/:assetId | Delete an unused owned asset and release quota; retained assets return 409 |

Use the dedicated binary endpoint, not the generic multipart uploader. Allowed types: image/jpeg (.jpg/.jpeg), image/png, image/webp, application/pdf. Each file is at most 25 MiB; total reserved and retained bytes cannot exceed 5 GiB. At most five unfinished uploads per athlete; upload requests are rate-limited to 30/minute/user/process. Hosted video uploads are excluded. Filename/type/declared size are checked; images are decoded with a 40-million-pixel limit, PDFs require PDF header/end markers. PDF checking is format validation, not malware scanning. Downloads use attachment disposition.

Reservations expire after 30 minutes. Started uploads have a 10-minute completion window. Completed unreferenced uploads have a one-hour attachment grace period; expired unused assets can be reclaimed. Referenced draft assets and submitted assets remain retained, counting once toward quota even when reused. Removing a draft item never deletes a submitted file. Quota is released only after successful provider deletion.

Portfolio storage and retrieval use the platform's existing Cloudinary provider with CLOUDINARY_CLOUD_NAME/CLOUDINARY_KEY/CLOUDINARY_SECRET. Wasabi is not used by this workflow. Assets use delivery type `authenticated`, unique server-owned IDs under `scout-portfolios/<athleteId>/<assetId>`, and overwrite=false. Images use resource type `image`; PDFs use `raw` with a `.pdf` public-ID suffix. Upload completion verifies the returned ID, resource/delivery type, byte count and image format before the asset can be attached; the server records the uploaded bytes' SHA-256 for retry checks. Generic public upload behavior is unchanged.

After portfolio authorization, the API returns a five-minute URL from Cloudinary's authenticated download API (`private_download_url`, attachment=true). These links expire and are not ordinary CDN delivery URLs; do not persist them as asset references. Store assetId and request a fresh link when needed. See [Cloudinary access controls](https://cloudinary.com/documentation/control_access_to_media). Signed links already issued may work for up to five minutes after withdrawal; subsequent authorization requests are denied. Cloudinary must support the configured file sizes and authenticated image/raw delivery in the deployment account; verify this in staging before rollout.

## Notifications and audit

Completed feedback emits scout.review.completed; admin decisions emit scout.report.decided after transaction commit. Consumers resolve user accounts from athlete/scout profiles, use dedupe keys, and create in-app notifications. Athletes receive feedback and approved-report notifications; scouts receive approval/denial notifications. Event failures are logged without reversing workflow changes. Delivery remains best effort under the existing in-process event bus; history APIs remain authoritative.

ScoutAudit records submission, withdrawal, review completion and report decisions with actor and timestamps. Withdrawal cancellation is also recorded on each affected review's status/completedAt/revision.

## Rollout and maintenance

MongoDB transactions require a replica set. No dependency, root middleware or root configuration changes are needed. These commands require SCOUT_MAINTENANCE_URI explicitly pointing to the intended database; they do not infer the production connection. Review the dry-run output before applying historical rating changes.

```powershell
# Set SCOUT_MAINTENANCE_URI securely in the process environment first.
npx ts-node src/modules/scout/scripts/portfolioMaintenance.ts indexes
npx ts-node src/modules/scout/scripts/recalculateRatings.ts
npx ts-node src/modules/scout/scripts/recalculateRatings.ts --apply
npx ts-node src/modules/scout/scripts/portfolioMaintenance.ts cleanup
```

Index creation is additive (never syncIndexes). Deploy indexes before enabling clients, and coordinate the queue contract change with both athlete and scout frontend adoption. No existing athlete is automatically submitted. Recalculate existing ratings once to remove historical denied-report weighting. Run cleanup hourly in the deployment scheduler; reservations also attempt bounded opportunistic cleanup. A nonzero cleanup exit indicates provider failures; retry after restoring storage access. These commands are provided, not automatically run against production.

Rollback requires coordinating frontend/queue behavior and keeping additive collections intact. Do not roll back to report endpoints without access checks while this feature remains exposed. Frontend implementation is outside this backend change.

## Acceptance checks

Use a disposable replica-set database and test storage; never a live database. Do not add or edit test files without instruction.

- Eligible athlete drafts, publishes, and appears to multiple scouts. One scout declines with feedback while another submits a report; only admin approval changes the rating.
- Concurrent publish/start calls create one version/review. Stale revisions fail. Concurrent approvals preserve all qualifying contributions. Older-version approval cannot displace a newer portfolio rating.
- Draft/profile changes leave snapshots unchanged. New versions allow fresh reviews. Withdrawal cancels unfinished work; pending reports can still be approved. Access loss pauses new activity while existing reviews finish; restoration resumes discovery.
- Verify ownership, self-review prevention, inactive scouts, forged identity/state fields, hidden report drafts, unavailable historical snapshots, and generic CRUD bypass attempts.
- Reject wrong type/size/content, over-quota concurrent reservations, foreign assets, mismatched submission downloads, and deletion of historical files. Verify cleanup releases quota once and retains referenced files.
- Verify notification recipients/deduplication, approved-only rating contributions, independent non-portfolio contributions, pagination, private storage, and five-minute signed URL expiry.
- Run `npx tsc --noEmit` and relevant existing payment-entitlement, notification, and filter tests. Smoke-test JPEG/PNG/WebP/PDF uploads, anonymous original/derived URL denial, five-minute download expiry, and cleanup against the intended staging Cloudinary account before rollout.

### Implementation validation

- TypeScript was checked without emitting build files.
- 78 inline assertions passed against an isolated MongoDB 7 replica set, including actual HTTP handlers/authentication, transaction races, version preservation, entitlement fallback, report visibility, rating replacement, notifications, storage accounting, cleanup, and maintenance command dry-run/apply behavior.
- The seven existing entitlement, notification-handler, and advanced-filter suites passed (18 tests). Jest used `--cacheDirectory node_modules/.cache/jest-scout` to avoid Windows sandbox temporary-cache restrictions.
- File content/quota handling used the real service with a stubbed storage boundary. No live storage or application database was used. No test files were added or modified.
- After switching portfolio storage to Cloudinary, TypeScript passed again. An additional 128 inline adapter assertions covered all four file types, authenticated uploads, overwrite protection, response validation, deletion outcomes, sanitized errors and real SDK URL signing/expiry with dummy credentials. Another 64 inline asset-service assertions verified type-aware download/deletion calls, unauthorized access, retained evidence and quota release after deletion. Provider I/O and persistence were mocked for these additional checks; live Cloudinary delivery remains a staging acceptance check.
