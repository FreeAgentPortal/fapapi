# Search Preferences Report Scheduler

This system provides automated report generation for search preferences using node-cron. It runs daily and generates reports for users based on their configured search preferences.

## Overview

The search preferences report scheduler consists of several components:

1. **ReportSchedulerCron** - Main cron job that runs daily
2. **SchedulerHandler** - Business logic for generating reports
3. **SearchReportEventHandler** - Handles notifications when reports are generated
4. **SchedulerService** - API endpoints for manual triggers and status
5. **schedulerRoutes** - Express routes for the scheduler API

## Features

- **Automated Daily Reports**: Runs every day at midnight (America/Los_Angeles timezone)
- **Flexible Frequency**: Supports daily, weekly, and monthly report generation
- **User Notifications**: Sends in-app notifications when reports are ready
- **Manual Triggers**: Admin endpoints to manually trigger report generation
- **Status Monitoring**: API endpoints to check scheduler status and statistics

## Database Schema

The system uses the existing `SearchPreferences` model with these key fields:

```typescript
{
  ownerType: 'team' | 'scout' | 'agent',
  ownerId: ObjectId,  // User who owns this search preference
  name: string,       // Name of the search preference
  frequency: number,  // 0 = disabled, >0 = enabled
  frequencyType: 'daily' | 'weekly' | 'monthly',
  dateLastRan: Date,  // When the search was last run
  // ... other search criteria fields
}
```

## How It Works

### 1. Daily Cron Job

The system runs a cron job every day at midnight:

```typescript
cron.schedule('0 0 * * *', async () => {
  await ReportSchedulerCron.processDailyReports();
});
```

### 2. Finding Due Preferences

The system queries for search preferences that are due for report generation based on:

- `frequency > 0` (enabled)
- `frequencyType` is set
- `dateLastRan` is either null or beyond the frequency threshold

### 3. Report Generation

For each due preference:

1. Calls `SchedulerHandler.generateReport(preference)`
2. Performs search based on the preference criteria
3. Generates report data
4. Updates `dateLastRan` field
5. Emits event for user notification

### 4. User Notification

When a report is generated:

1. Event `search.report.generated` is emitted
2. `SearchReportEventHandler` receives the event
3. Creates an in-app notification for the user
4. Future: Can be extended to send email notifications

## API Endpoints

### Admin Endpoints (require admin/developer role)

#### Get Scheduler Status

```
GET /api/v1/search-preferences/scheduler/status
```

Response:

```json
{
  "success": true,
  "data": {
    "scheduler": {
      "isRunning": false,
      "nextRun": "2025-07-08T07:00:00.000Z"
    },
    "statistics": {
      "totalSearchPreferences": 25,
      "activeSearchPreferences": 12
    }
  }
}
```

#### Trigger All Due Reports

```
POST /api/v1/search-preferences/scheduler/trigger/all
```

#### Trigger Specific Report

```
POST /api/v1/search-preferences/scheduler/trigger/{preferenceId}
```

### User Endpoints (require authentication)

#### Get User's Search Preferences

```
GET /api/v1/search-preferences/scheduler/preferences
```

#### Update Scheduling Settings

```
PATCH /api/v1/search-preferences/scheduler/preferences/{preferenceId}/schedule
```

Body:

```json
{
  "frequency": 1,
  "frequencyType": "weekly"
}
```

## Configuration

### Frequency Settings

- **frequency**: `0` = disabled, `>0` = enabled
- **frequencyType**:
  - `"daily"` - Generate report every day
  - `"weekly"` - Generate report every 7 days
  - `"monthly"` - Generate report every 30 days

### Timezone

The cron job runs in `America/Los_Angeles` timezone. This can be configured in:

- `ReportSchedulerCron.init()`
- Main `cronjobs.ts` file

## Event System

The scheduler integrates with the existing event bus system:

### Events Emitted

#### `search.report.generated`

```typescript
{
  userId: string,
  ownerType: 'team' | 'scout' | 'agent',
  searchPreferenceName: string,
  reportId: string,
  resultCount: number,
  generatedAt: Date
}
```

## Implementation Status

### ✅ Completed

- Cron job setup with node-cron
- Database queries for due preferences
- Report generation handler structure
- Event emission for notifications
- API endpoints for manual triggers
- Admin and user routes
- Integration with existing event bus

### 🚧 TODO (Future Implementation)

- **Actual Search Logic**: Replace mock search with real athlete/player queries
- **Report Storage**: Store generated reports in database
- **Email Notifications**: Extend to send email when reports are ready
- **Report Viewing**: Frontend endpoints to view generated reports
- **Advanced Scheduling**: Support for custom time preferences
- **Performance Optimization**: Batch processing for large numbers of preferences

## Usage Examples

### Enable Daily Reports for a Search Preference

```javascript
// Update a search preference to generate daily reports
PATCH /api/v1/search-preferences/scheduler/preferences/64a7b123456789abcdef1234/schedule
{
  "frequency": 1,
  "frequencyType": "daily"
}
```

### Disable Reports

```javascript
// Disable report generation
PATCH /api/v1/search-preferences/scheduler/preferences/64a7b123456789abcdef1234/schedule
{
  "frequency": 0
}
```

### Manual Testing

```javascript
// Manually trigger report for testing
POST /api/v1/search-preferences/scheduler/trigger/64a7b123456789abcdef1234
```

## Monitoring and Debugging

### Logs

The system provides comprehensive logging:

```
[ReportScheduler] Starting daily report generation process...
[ReportScheduler] Found 5 search preferences due for reports
[Scheduler] Generating report for search preference: Weekly Player Search (ID: 64a7b...)
[Scheduler] Report generated successfully for preference: Weekly Player Search
[SearchReportEventHandler] Notification created for user 64a7b...
[ReportScheduler] Daily report generation completed. Success: 5, Errors: 0
```

### Error Handling

- Individual report failures don't stop the entire process
- Comprehensive error logging for debugging
- Status endpoint shows system health

## Integration Points

### With Existing Systems

1. **Notification System**: Uses existing `Notification.insertNotification()`
2. **Event Bus**: Integrates with `eventBus.publish()`
3. **Authentication**: Uses existing `AuthMiddleware`
4. **Database**: Extends existing `SearchPreferences` model
5. **Cron Jobs**: Integrates with existing `cronjobs.ts`

### Future Integrations

1. **Email Service**: Can be extended to use existing `EmailService`
2. **Search Engine**: Will integrate with actual player/athlete search
3. **Report Storage**: Can be extended with dedicated report models
4. **Analytics**: Can track report generation metrics

## Testing

### Manual Testing Commands

```bash
# Check scheduler status
curl -X GET http://localhost:5000/api/v1/search-preferences/scheduler/status

# Trigger all reports (admin only)
curl -X POST http://localhost:5000/api/v1/search-preferences/scheduler/trigger/all

# Update user's search preference schedule
curl -X PATCH http://localhost:5000/api/v1/search-preferences/scheduler/preferences/ID/schedule \
  -H "Content-Type: application/json" \
  -d '{"frequency": 1, "frequencyType": "daily"}'
```

### Database Testing

```javascript
// Create a test search preference with daily reports
db.searchpreferences.insertOne({
  ownerType: 'team',
  ownerId: ObjectId('64a7b123456789abcdef1234'),
  name: 'Test Daily Search',
  frequency: 1,
  frequencyType: 'daily',
  positions: ['Forward', 'Midfielder'],
  dateLastRan: null, // Will trigger on next run
});
```

## Performance Considerations

- The cron job includes a lock mechanism to prevent overlapping runs
- Individual report failures are isolated and logged
- Database queries are optimized with indexes on `frequency` and `dateLastRan`
- Memory usage is managed by processing preferences sequentially

## Security

- Admin endpoints require `admin` or `developer` roles
- User endpoints verify ownership of search preferences
- Input validation on all scheduling parameters
- Authentication required for all endpoints
