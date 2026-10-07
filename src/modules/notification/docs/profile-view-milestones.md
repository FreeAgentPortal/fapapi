# Profile-view milestone alerts

The notification scheduler runs at 09:00 America/New_York outside development.
It counts recorded team, scout, and agent view sessions separately for each
athlete/professional profile. Existing session deduplication and in-app alerts
are unchanged. Monthly thresholds are 1, 5, 10, and 50; only the highest new
threshold is delivered, with the actual qualifying view count in the message.

Calendar months and daily limits use Eastern time, including DST. On the first
day of each month the previous month takes priority, and a current-month alert
waits until the next day if that channel attempted a closing alert. There is
no historical catch-up after that closing day. A persistent launch marker means
the first live run only considers its current month; dry runs do not establish
the launch date.

Email respects `accountNotificationEmail !== false`; SMS requires
`accountNotificationSMS === true` and a valid account phone number. Both profile
and user must still be active, and ownership/consent is checked again before
delivery. Each channel advances independently. SMS failure does not resend a
successful email. Each channel can attempt at most once per profile per Eastern
day, including manual triggers and failures. The next day's attempt uses the
highest then-current milestone, not a queue of older milestones.

## Internal preview and manual delivery

With the application's database connection established:

```typescript
import { ProfileViewMilestoneScheduler } from '../cron/ProfileViewMilestoneScheduler.cron';

// Read-only: no launch marker, claim, delivery record, or provider send.
const preview = await ProfileViewMilestoneScheduler.triggerManualAlerts({
  subjectType: 'athlete',
  subjectProfileId: 'VALID_PROFILE_OBJECT_ID',
});

// Explicit delivery; requires the normal EmailService/SMSService initialization.
const result = await ProfileViewMilestoneScheduler.triggerManualAlerts({
  subjectType: 'athlete',
  subjectProfileId: 'VALID_PROFILE_OBJECT_ID',
  dryRun: false,
});
```

Omit the profile filter to process all qualifying profiles. Results count
`profiles`, `eligible`, `sent`, `skipped`, and `failed`; delivery counts are per
channel. `eligible` includes attempted sends that fail, but not infrastructure
failures before eligibility is established. Dry-run eligibility is a snapshot,
not a reservation. Providers and a live database are not needed for mocked
validation. Production delivery still uses the existing SendGrid and Twilio
credentials; no SendGrid dashboard template is required.

## Persistence and operations

The new `profile_view_milestone_deliveries` collection has three record kinds:

- `launch`: the first live run's timestamp.
- `gate`: one profile/channel daily attempt guard and 15-minute database lease,
  shared across owners and months to serialize competing workers.
- `delivery`: owner/profile/month/channel progress, highest delivered milestone,
  attempt/delivery timestamps, and failure/claim state.

Deterministic `_id` keys provide atomic uniqueness without a separate index
migration. The collection is created lazily by the first live write; importing
the model or previewing does not automatically create it. Do not delete delivery
history or the launch marker during normal operation: it governs repeat sends.

Check `[ProfileViewMilestones] Run summary` and delivery failure logs. Failures
remain retryable only within that month and its closing run. Provider acceptance
followed by a database failure can still cause a duplicate on a later retry;
exactly-once delivery is not guaranteed. Removing the scheduler registration
stops future scheduled attempts while preserving delivery history.
