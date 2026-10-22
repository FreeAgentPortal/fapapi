# Monthly revenue forecasts

The yearly report separates **remaining collections** from the **full-month forecast used by the chart**.

- `timeline[].projectedContracted`, `projectedCollectible`, `projectedAtRisk`, and `projectedCharges` continue to describe remaining collections. Full-year totals and acquisition scenarios use these values.
- `timeline[].monthlyForecast` contains `contracted`, `collectible`, `atRisk`, `charges`, `source`, and `capturedAt`. The chart uses these amounts. Do not add saved forecasts to collected revenue when calculating annual totals.

## Saved baselines

`MonthlyRevenueForecast` stores one immutable document per USD/UTC month, keyed by `USD:YYYY-MM`. It includes the capture timestamp, calculation version, amounts, and provenance. Atomic `$setOnInsert` writes and MongoDB's `_id` uniqueness prevent repeat runs or multiple workers from overwriting a baseline.

The payment scheduler captures the current month at 00:00 UTC on the first, initializes missing months at startup, and retries before each scheduled-payment run, including manual triggers. Snapshot failures are logged and do not block collection. Development skips scheduler initialization under the existing cron policy; use the command below to persist development baselines.

- `month_boundary`: captured within the first minute of the UTC month.
- `receipt_backfill`: a completed month reconstructed from successful USD Stripe subscription and proration receipts. Setup fees, unrelated categories, refunds, fees, failed attempts, and identifiable duplicate payments are excluded. Contracted and collectible both equal successful gross collections; at-risk is zero.
- `mid_month_initialization`: successful receipts so far plus the remaining forecast, captured once. This is also the recovery behavior when a month-boundary capture was missed.

Missing months in the current calendar year are initialized, including zero-revenue months. Prior-year documents are retained; the report still returns the current year. Receipt backfills do not recreate historical billing-account state and are not refreshed automatically after late receipt recovery.

Future months use `source: live` and `capturedAt: null`. Before initialization, report reads return `receipt_fallback` or `current_month_fallback` with null capture timestamps. Report reads do not persist anything. The UI uses the same labels without estimate badges; source metadata remains available for diagnostics.

## Initialization and deployment

From the API root, using the same database environment as the API:

```powershell
npx ts-node src/modules/payment/scripts/initializeRevenueForecasts.ts --dry-run
npx ts-node src/modules/payment/scripts/initializeRevenueForecasts.ts --apply
```

Dry-run lists only missing candidates and does not create collections, indexes, or snapshots. Apply inserts missing records and leaves existing records unchanged. Deploy the additive API, inspect initialization output, then deploy the admin chart. The frontend accepts the previous API shape during rollout.

If initialization fails, inspect the `[RevenueForecast]` server log, resolve database access or availability, and rerun the command or allow the next billing run to retry. Never delete saved baselines to refresh live forecasts.

## Forecast calculation

Credits are consumed across future charges in integer cents. Renewal dates use the role-specific billing policies with an explicit UTC reporting option; collection keeps its existing local-time default. Professional monthly subscriptions recur every 30 days. Annual subscriptions preserve their anniversary, and an overdue account contributes one immediate charge before resuming its stored anchor. Pending cancellations, suspended accounts, and inactive accounts remain excluded.
