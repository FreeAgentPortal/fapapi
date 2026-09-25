# Admin Authentication Activity Analytics: Frontend Handoff

## Purpose

The authentication activity API gives the admin panel a 60-day operational view of authenticated user activity. It supports:

- dashboard totals and trends;
- a paginated list of recently active users;
- a summary and paginated activity timeline for one user.

This data is intended for product usage insights and lightweight account investigation. It is not a request-by-request audit trail.

## Base URL and authorization

All routes are mounted below:

```text
/api/v1/auth/analytics/activity
```

Every request must include:

```http
Authorization: Bearer <jwt>
X-Service-Name: admin
```

The authenticated admin profile must have the `users.activity` permission. A request without a valid JWT receives `401`; an authenticated user without the permission receives `403`.

The `X-Service-Name: admin` header is important because the API uses the admin profile selected by that header to load the caller's admin permissions.

## Shared query parameters

| Parameter | Accepted values | Default | Applies to |
| --- | --- | --- | --- |
| `days` | `7`, `30`, or `60` | `7` | All endpoints |
| `pageNumber` | Positive integer | `1` | Recent users and user detail |
| `pageLimit` | Integer from `1` through `100` | `25` | Recent users and user detail |
| `limit` | Integer from `1` through `100` | `25` | Backward-compatible alias for `pageLimit` |

If both `pageLimit` and `limit` are provided, `pageLimit` wins. Invalid values receive a `400` response with a human-readable `message`.

All dates are serialized as ISO 8601 UTC strings.

## 1. Dashboard summary

```http
GET /api/v1/auth/analytics/activity/summary?days=30
```

Example response:

```json
{
  "success": true,
  "payload": {
    "range": {
      "days": 30,
      "startDate": "2026-07-21T18:00:00.000Z",
      "endDate": "2026-08-20T18:00:00.000Z"
    },
    "activeUsers": 418,
    "activeSessions": 502,
    "totalActivityBuckets": 2874,
    "approximateRequestCount": 3120,
    "dailyActiveUsers": [
      {
        "date": "2026-08-19",
        "activeUsers": 96
      },
      {
        "date": "2026-08-20",
        "activeUsers": 74
      }
    ],
    "activeUsersByRole": [
      {
        "role": "athlete",
        "activeUsers": 311
      },
      {
        "role": "professional",
        "activeUsers": 62
      }
    ]
  }
}
```

Recommended UI mapping:

- `activeUsers`: primary KPI card.
- `activeSessions`: secondary KPI card.
- `totalActivityBuckets`: label as **Tracked active hours** or **Activity samples**, not requests.
- `approximateRequestCount`: label explicitly as **Approximate tracked requests**.
- `dailyActiveUsers`: line or bar chart; dates are UTC calendar dates.
- `activeUsersByRole`: role distribution chart or ranked list.

The daily series only includes dates that contain activity. The frontend should fill missing dates with zero if the chart requires a continuous axis.

## 2. Recently active users

```http
GET /api/v1/auth/analytics/activity/recent?days=30&pageNumber=1&pageLimit=25
```

Example response:

```json
{
  "success": true,
  "payload": [
    {
      "userId": "66c75e70f1b6d743dd993c44",
      "user": {
        "_id": "66c75e70f1b6d743dd993c44",
        "fullName": "User A",
        "email": "usera@example.com",
        "profileImageUrl": "https://example.com/avatar.jpg",
        "role": ["athlete"],
        "isActive": true
      },
      "roles": ["athlete"],
      "profileRefs": {
        "athlete": "66c75ea8f1b6d743dd993c49"
      },
      "lastSeenAt": "2026-08-20T17:42:11.000Z",
      "lastPath": "/api/v1/feed",
      "lastMethod": "GET",
      "lastServiceName": "athlete",
      "approximateRequestCount": 18,
      "activityBuckets": 16,
      "activeSessions": 2
    }
  ],
  "metadata": {
    "days": 30,
    "page": 1,
    "limit": 25,
    "pages": 8,
    "totalCount": 184,
    "prevPage": null,
    "nextPage": 2
  }
}
```

This endpoint returns one row per user, ordered by most recent activity. A user record may be missing if the associated user was deleted after the activity was recorded; use `userId` as the stable row key and provide an “Unavailable user” fallback.

Recommended columns:

- user avatar, name, and email;
- current account status from `user.isActive`;
- roles;
- relative last-seen time with the full UTC timestamp available in a tooltip;
- last service and method/path;
- active sessions;
- activity samples.

Clicking a row should navigate to the existing admin user detail screen using `userId`. That screen can then request the user-specific endpoint below.

Reset `pageNumber` to `1` whenever the selected `days` value changes. Disable previous/next controls when the corresponding metadata field is `null`.

## 3. One user's activity

```http
GET /api/v1/auth/analytics/activity/users/66c75e70f1b6d743dd993c44?days=30&pageNumber=1&pageLimit=25
```

Example response:

```json
{
  "success": true,
  "payload": {
    "user": {
      "_id": "66c75e70f1b6d743dd993c44",
      "firstName": "User",
      "lastName": "A",
      "fullName": "User A",
      "email": "usera@example.com",
      "profileImageUrl": "https://example.com/avatar.jpg",
      "role": ["athlete"],
      "isActive": true,
      "lastSignedIn": "2026-08-20T14:12:00.000Z"
    },
    "range": {
      "days": 30,
      "startDate": "2026-07-21T18:00:00.000Z",
      "endDate": "2026-08-20T18:00:00.000Z"
    },
    "summary": {
      "firstSeenAt": "2026-07-22T12:08:13.000Z",
      "lastSeenAt": "2026-08-20T17:42:11.000Z",
      "activityBuckets": 16,
      "approximateRequestCount": 18,
      "activeSessions": 2
    },
    "entries": [
      {
        "_id": "68a75ed768aef7db59886712",
        "bucketStart": "2026-08-20T17:00:00.000Z",
        "firstSeenAt": "2026-08-20T17:42:11.000Z",
        "lastSeenAt": "2026-08-20T17:42:11.000Z",
        "approximateRequestCount": 1,
        "lastPath": "/api/v1/feed",
        "lastMethod": "GET",
        "lastServiceName": "athlete",
        "sessionSource": "header",
        "ipAddress": "203.0.113.42",
        "userAgent": "Mozilla/5.0 ...",
        "roles": ["athlete"]
      }
    ]
  },
  "metadata": {
    "days": 30,
    "page": 1,
    "limit": 25,
    "pages": 1,
    "totalCount": 16,
    "prevPage": null,
    "nextPage": null
  }
}
```

The API validates that the user exists. An invalid MongoDB id returns `400`; a valid id with no matching user returns `404`. An existing user with no activity in the selected range returns `200` with zeroed summary values and an empty `entries` array.

Recommended user-detail layout:

1. Preserve the existing user header and account controls.
2. Add an **Authentication activity** section or tab.
3. Show last seen, active sessions, activity samples, and approximate tracked requests as compact summary cards.
4. Render `entries` newest first in a table or timeline.
5. Keep IP address and user agent behind an expandable “Technical details” affordance because they are sensitive and visually noisy.
6. Provide a clear empty state: “No authentication activity was recorded in the selected period.”

Do not display or attempt to derive a session token. The API intentionally never exposes `sessionHash`.

## Suggested TypeScript contracts

```ts
export type ActivityRangeDays = 7 | 30 | 60;

export interface ActivityPagination {
  days: ActivityRangeDays;
  page: number;
  limit: number;
  pages: number;
  totalCount: number;
  prevPage: number | null;
  nextPage: number | null;
}

export interface ActivityUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  profileImageUrl?: string;
  role?: string[];
  isActive?: boolean;
  lastSignedIn?: string;
}

export interface UserActivityEntry {
  _id: string;
  bucketStart: string;
  firstSeenAt: string;
  lastSeenAt: string;
  approximateRequestCount: number;
  lastPath: string;
  lastMethod: string;
  lastServiceName?: string;
  sessionSource: 'header' | 'jwt';
  ipAddress?: string;
  userAgent?: string;
  roles: string[];
}
```

Treat optional database fields as optional even when an example contains them. Older activity records may not have every field.

## Suggested API client helper

Use the admin panel's existing authenticated HTTP client if one exists. The equivalent request setup is:

```ts
const getAdminActivity = async <T>(path: string): Promise<T> => {
  const response = await fetch(`/api/v1/auth/analytics/activity${path}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'X-Service-Name': 'admin',
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || 'Unable to load authentication activity');
  }

  return body as T;
};
```

Do not create a separate authentication flow for these endpoints. Reuse the admin panel's existing token refresh and global `401`/`403` handling.

## Loading, caching, and refresh behavior

- Fetch summary and recent users in parallel on the analytics dashboard.
- Cache each `days` selection independently.
- A stale time of one to five minutes is appropriate; activity is sampled hourly, so polling every few seconds adds no value.
- Keep previous page data visible while loading the next page to prevent table layout jumps.
- On the user screen, do not request activity until a valid user id is available from the route.
- A manual refresh action is sufficient for investigations that need a fresh view.

## Error and empty-state handling

Typical error body:

```json
{
  "success": false,
  "message": "pageNumber must be a positive integer"
}
```

Handle statuses as follows:

- `400`: show the returned validation message; malformed UI-generated query values should also be reported to frontend monitoring.
- `401`: use the existing session-expired flow.
- `403`: show an access-denied state rather than an empty report.
- `404`: on user activity, show that the account no longer exists or return to the user list.
- `500`: show the standard retry state and preserve the selected range/page.

An empty successful payload is not an error.

## Data semantics and privacy

Activity tracking is deduplicated into hourly buckets for each user and session. Consequently:

- `activityBuckets` measures sampled active user/session hours, not raw page views;
- `approximateRequestCount` is directional and should not be presented as an exact request total;
- `lastSeenAt` is the latest recorded sample, not guaranteed presence at that exact moment;
- `activeSessions` counts distinct hashed session identifiers observed in the selected range; it does not mean those sessions are still valid;
- role values are snapshots captured when activity was recorded and can differ from the user's current `role` value;
- records expire automatically approximately 60 days after `bucketStart`.

IP address and user-agent values are operationally sensitive. Do not include them in exports, analytics telemetry, URLs, or client-side logs. Only reveal them to an authorized admin who deliberately opens technical details.

## Acceptance checklist

- The admin analytics dashboard loads summary and recent-user requests in parallel.
- The range selector supports exactly 7, 30, and 60 days.
- Recent-user pagination uses the server-provided metadata.
- Selecting a user opens their existing admin detail view and loads the user activity endpoint.
- Empty activity and missing-user states are distinct.
- IP address and user agent are not shown by default.
- `users.activity` access failures render as access denied, not “no data.”
- UI labels make the approximate, hourly-sampled nature of the data clear.
- No session hashes or authentication secrets are stored or rendered by the frontend.
