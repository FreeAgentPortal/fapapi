# SmartRetries

Only the scheduled subscription collector enrolls charges. Signup payments, setup
fees, prorations, and one-time transactions retain their existing behavior. Stripe
is the currently configured processor; eligibility requires its structured
`insufficient_funds` decline, not a match on an error message.

## Collection lifecycle

- Charge on the stored renewal date, then retry on UTC billing days 1, 3, 5, 7.
  The existing cron runs at 09:00 America/Los_Angeles. Retry dates do not replace
  `nextBillingDate`; settlement advances the original renewal anchor.
- Missing cron runs do not extend the window. Missed slots are skipped after the
  next attempt; expiration occurs after the end of UTC day 7. There is at most one
  submitted attempt per UTC day and five automatic attempts per unpaid cycle.
- `retrying` retains the existing active/trialing status and access. Every declined
  attempt creates a receipt and emits the existing payment-failure event.
- `exhausted` means suspended with `needsUpdate=true` and no next attempt.
  Non-retryable declines stop the sequence immediately.
- Saving a replacement card during retries consumes the next remaining slot on
  the next daily run, preserving the attempt count and deadline. After exhaustion,
  it queues one `recovery_pending` attempt; access remains suspended until paid.
  Failed recovery requires another replacement-card update, not a new retry cycle.
- Plan/cycle changes return HTTP 409 while a collection is unresolved. Cancellation
  blocks new submissions and clears retry state when finalized. Card removal stops
  collection, but does not extend the original deadline.
- The cycle snapshots the charge and applied credits in cents. Credits are deducted
  once at settlement; retry failures do not consume them. Success clears account
  retry state while receipts retain the payment history.

## Interrupted attempts and reconciliation

Each attempt is claimed atomically on BillingAccount before processor submission.
Stripe receives `subscription-<billingId>-<attemptId>` as its idempotency key, along
with the specific claimed payment method. Concurrent workers/manual triggers skip
the claimed account. `skipped` is included in the manual scheduler response.

`processing` is never automatically reclaimed. An uncertain processor result, or
failure while writing a receipt/settlement, becomes `review` when persistence is
available. A crashed worker or unavailable database can leave `processing` behind.
The scheduler logs review records and processing records older than an hour.
Card updates and plan changes return HTTP 409 until these records are reconciled.

For reconciliation, inspect the stored `smartRetries.outcome`, processor transaction
ID, Stripe request/idempotency history, and existing receipts. Confirm whether the
attempt collected money before changing state. A successful payment requires the
receipt and local credit/renewal settlement, not a new processor request. If no
payment occurred, restore only the remaining eligible retry slot or mark exhausted;
do not reset the due date or restart the seven-day window. Reconciliation remains
an operator action; this feature does not add a reconciliation endpoint.

## Rollout and validation

No backfill is required: missing `smartRetries` means normal billing. Previously
suspended accounts are not automatically enrolled. No dependencies or cron/root
configuration change. Before rolling back, stop scheduled/manual collection and
resolve outstanding retry records: older code does not understand their dates or
claims.

Run `tsc --noEmit` and the payment-module Jest suites. New tests mock persistence
and processors; they never submit live charges or send real notifications.
