# Announcements / feature updates

The module stores each announcement once. `belongs_to` is a nonempty array of portal tags, so an announcement tagged `["player", "admin", "agent"]` appears in all three portals. Editing it changes the shared content everywhere. Removing a tag removes it from that portal; `enabled: false` hides it everywhere.

Delivery preserves the frontend `FeatureUpdatesConfig` shape: `{ appId, title, items }`. Each item preserves the fields from `packages/features/src/featureUpdates/featureUpdates.types.ts`. Administration adds `_id`, `belongs_to`, `displayOrder`, `revision`, timestamps, and creator/editor user IDs. These administration fields are excluded from public delivery.

## Portal identities

Supported tags: `player`, `admin`, `agent`, `team`, `scout`, `professional`, `auth`, `public-portal`.

Use the canonical singular `agent` tag in storage and queries. Its returned `appId` is `agents`, matching the existing agents app's browser acknowledgment namespace. Other tags return the same value as `appId`. `GET /admin/portals` supplies the admin editor's options and current titles. Titles are stored separately per portal; unconfigured portals use `Check out What's new on Free Agent Portal`.

Tags select where content appears; they are not confidentiality or authorization controls. The public endpoint can be queried without authentication, including for the admin tag. Store public announcements here, as with the current bundled frontend content.

## API

All paths below are relative to `/api/v1/feature-updates`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/public?belongs_to=player` | `{ success: true, payload: { appId, title, items } }`; enabled matching items only |
| GET | `/admin` | Paginated announcements, including disabled items |
| POST | `/admin` | Create an announcement; returns 201 and the saved record |
| GET | `/admin/:id` | Read an announcement by MongoDB ID |
| PATCH | `/admin/:id` | Update specified fields; requires the current numeric `revision` |
| DELETE | `/admin/:id` | Delete globally; JSON body `{ "revision": 0 }` required |
| GET | `/admin/portals` | Portal options, acknowledgment app IDs, and titles |
| PUT | `/admin/portals/:portal` | Set a portal title with `{ "title": "What's new" }` |

All `/admin` endpoints use the existing `AuthMiddleware.protect` and `authorizeRoles(['admin'])`. The admin frontend should use its existing API client, Bearer token, and `x-service-name: admin` profile context. Client-supplied actor IDs and MongoDB operators are rejected.

Admin listing accepts an optional single `belongs_to` tag, `pageNumber` (default 1), and `pageLimit` (default 20, maximum 100). The response is `{ success, payload: [records], metadata: { totalCount, pageNumber, pageLimit } }`. Other record responses use `{ success, payload: record }`; deletion returns `{ success: true }`.

Public requests require exactly one valid tag. Missing, invalid, array, and object values produce 400. A valid portal with no matching announcements returns 200 with an empty `items` array. Requests have `Cache-Control: no-store`. Disabled content remains available to admins only.

### Create example

```json
{
  "key": "express-interest-v1",
  "name": "Express Interest",
  "description": "Reach out to teams when they are accepting interest.",
  "releasedAt": "2026-09-12",
  "badge": "New feature",
  "highlights": ["Your athlete profile goes with an optional note."],
  "media": {
    "type": "image",
    "src": "https://example.com/express-interest.png",
    "alt": "Express Interest feature",
    "options": { "placement": "banner", "fit": "contain", "aspectRatio": 3 }
  },
  "action": { "type": "internal", "label": "Explore Team Finder", "href": "/team-finder" },
  "belongs_to": ["player", "admin", "agent"],
  "displayOrder": 0,
  "enabled": false
}
```

Ensure a shared action's destination exists in every tagged app. A root-relative URL is resolved by each app's origin. When destinations or copy differ, create separate announcements with different keys and audiences.

### Editing and delivery rules

- Required creation fields: `key`, `name`, `description`, `releasedAt`, `belongs_to`. New announcements default to disabled and `displayOrder: 0`. Explicitly enable them to publish.
- `key` is globally unique and immutable. Keep existing keys during migration. To announce a revision again, create a new versioned key. Ordinary edits do not reset frontend acknowledgments.
- Include the `revision` returned by the last admin read in PATCH and DELETE. Stale or concurrent changes return 409; reload before retrying. Missing records return 404 and invalid inputs return 400. Unique key conflicts return 400 through the existing error middleware.
- PATCH replaces a supplied `belongs_to`, `highlights`, `media`, or `action` value in full. Omitted fields remain unchanged. Use `null` to clear `badge`, `media`, or `action`, and `[]` to clear highlights. Send editable fields plus `revision`, not the complete admin response.
- Items sort by `displayOrder` ascending, then `releasedAt` descending, then `_id` ascending for ties. Order is shared across portals in this version. Preserve each existing config's explicit array order using `displayOrder` during import.
- `releasedAt` is a real `YYYY-MM-DD` calendar date and is display metadata, not a publication scheduler. Visibility depends on `enabled` and portal membership.
- Media supports image/video, required alt text, placement, fit, positive aspect ratio, controls, autoplay, muted, loop, and poster. URLs must be root-relative or HTTPS; internal actions must use root-relative paths. Optional playback fields stay omitted when unset so the existing renderer retains its defaults. No upload pipeline is added; use existing hosted media URLs.
- Portal title updates are simple last-write-wins settings, independent of announcement revisions.

## Frontend migration plan

Frontend repository: `freeagentportal/fap/freeagentmono`. This backend change does not edit that repository or populate a database.

1. **Import existing data before switching consumers.** Read `apps/player/src/data/featureUpdates.config.ts` and `apps/agents/src/data/featureUpdates.config.ts`. Create records from their items, keep keys and dates, attach `belongs_to: ['player']` or `['agent']`, set `displayOrder` to the array index, and explicitly set `enabled` to the existing effective value (`item.enabled !== false`). Save each config title via the portal settings endpoint. If identical announcements are shared, merge their tags into one record after reviewing copy, links, keys, and order. Resolve conflicting global keys before importing. Do not expose disabled draft content during import.
2. **Add typed fetch actions and a shared query hook.** Use each app's existing API client and React Query conventions. Fetch `/feature-updates/public?belongs_to=<tag>`, unwrap `payload`, and expose a stable `FeatureUpdatesConfig` reference. Key requests by portal and share the player request between its dashboard and modal. Keep `agent` as the request tag while retaining the returned `appId: 'agents'`. On missing/loading/error data render no announcements; do not fall back to the old file indefinitely, because that can resurrect disabled announcements. Use a short stale time/refetch policy so publish/disable changes become visible without a deployment.
3. **Replace the three current consumers.** Update `apps/player/src/features/dashboard/PlayerDashboard.feature.tsx`, `apps/player/src/features/profileSetup/ProfileSetupPrompt.component.tsx`, and `apps/agents/src/features/dashboard/AgentDashboard.feature.tsx`. Pass fetched configs to `FeatureUpdatesShowcase` and `FeatureUpdatesModal`. Preserve the player's existing profile-setup gating (`pathname === '/' && !isOpen`) and viewer identity. Empty successful results should hide both surfaces. No rewrite of `FeatureUpdateContent.tsx` is required.
4. **Handle refreshes during modal/media playback.** `FeatureUpdatesModal.tsx` currently rebuilds its batch whenever the config reference changes. Keep query references stable and defer adopting refreshed content while the user is navigating or playing media; apply the new snapshot on the next opening. Preserve local storage keys based on appId, viewerId, and item key. Do not acknowledge items solely because fetching completed.
5. **Build the admin management page.** Follow `apps/admin/src/views/admin/sponsors` for API actions, query hooks, access handling, table, create/edit modal, and delete dialog. Add an announcements page and navigation entry. Use `/admin/portals` for a multi-select `belongs_to` input. Include portal filtering, enabled/draft state, display order, the full media/action editor, preview using `FeatureUpdateContent`, and a per-portal title editor. Keep `key` editable only during creation. Persist the loaded revision with changes; handle 409 by retaining the draft and offering reload/reconciliation. Make global deletion and shared edits explicit in the UI; removing one portal tag is how to remove content from one portal only.
6. **Validate and cut over.** Check shared membership, disabled records, empty/error/loading states, admin access, create/edit/delete, stale revision handling, ordering, image/video options, action destinations, and unchanged acknowledgment behavior. Verify a `[player, admin, agent]` record appears in each matching response and never in a team-only response. Review imports before deleting the two static config files. Add other portal consumers using their canonical tags as needed.

Database deployment should build the model indexes (unique `key`, unique portal settings, and the membership/delivery index) under the repository's existing Mongoose index management process before enabling admin writes.
