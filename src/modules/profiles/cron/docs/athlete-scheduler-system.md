# Athlete Profile Completion Scheduler

This system provides automated reminders for athlete profiles to encourage them to complete their profiles by filling in key metrics such as profile images, measurements, metrics, and resumes.

## Overview

The athlete profile completion scheduler consists of several components:

1. **AthleteSchedulerCron** - Main cron job that runs daily at 9:00 AM
2. **AthleteProfileCompletionHandler** - Business logic for checking profile completion and sending alerts
3. **AthleteSchedulerService** - API endpoints for manual triggers and status monitoring
4. **athleteSchedulerRoutes** - Express routes for the scheduler API

## Features

- **Automated Daily Alerts**: Runs every day at 9:00 AM (America/Los_Angeles timezone)
- **Profile Completion Analysis**: Checks for missing profileImageUrl, metrics, measurements, and resume
- **Smart Alert Frequency**: Avoids spamming users by checking for recent alerts (7-day cooldown)
- **User Notifications**: Sends in-app notifications when profiles are incomplete
- **Manual Triggers**: Admin endpoints to manually trigger alerts
- **Status Monitoring**: API endpoints to check scheduler status and completion statistics

## Database Schema

The system works with the existing `AthleteProfile` model and checks these key fields:

```typescript
{
  profileImageUrl: string,    // Required for visual profile
  metrics: Map<string, number>,        // Performance metrics (40-yard dash, etc.)
  measurements: Map<string, string>,   // Physical measurements (height, weight)
  // Resume is checked via ResumeProfile model with owner reference
}
```

## How It Works

### 1. Daily Cron Job

The system runs a cron job every day at 9:00 AM:

```typescript
cron.schedule('0 9 * * *', async () => {
  await AthleteSchedulerCron.processAthleteProfileCompletionAlerts();
});
```

### 2. Finding Incomplete Profiles

The system queries for athlete profiles that are incomplete based on:

- `isActive: true` (only active athletes)
- `createdAt` is older than 24 hours (give new users time to complete)
- Missing at least one key field: `profileImageUrl`, `metrics`, `measurements`, or `resume`

### 3. Alert Generation

For each incomplete profile:

1. Calls `AthleteProfileCompletionHandler.checkProfileCompletion(athlete)`
2. Calculates completion percentage and missing fields
3. Checks if alert should be sent (7-day cooldown)
4. Creates in-app notification with personalized message
5. Emits event for potential email notification

### 4. User Notification

When an alert is generated:

1. Creates an in-app notification with completion percentage and missing fields
2. Event `athlete.profile.completion.alert` is emitted
3. Future: Can be extended to send email notifications

## API Endpoints

### Admin Endpoints (require admin/developer role)

#### Get Scheduler Status

```
GET /api/v1/profiles/scheduler/status
```

Response:

```json
{
  "success": true,
  "data": {
    "scheduler": {
      "isRunning": false,
      "nextRun": "2025-08-26T16:00:00.000Z"
    },
    "statistics": {
      "totalAthletes": 150,
      "incompleteProfiles": 45,
      "completionRate": 70.0,
      "missingFields": {
        "profileImage": 25,
        "metrics": 30,
        "measurements": 20,
        "resume": 35
      }
    }
  }
}
```

#### Trigger All Completion Alerts

```
POST /api/v1/profiles/scheduler/trigger/all
```

#### Trigger Specific Alert

```
POST /api/v1/profiles/scheduler/trigger/{athleteId}
```

#### Get Incomplete Profiles

```
GET /api/v1/profiles/scheduler/incomplete?page=1&limit=20
```

#### Get Completion Statistics

```
GET /api/v1/profiles/scheduler/statistics
```

### User Endpoints (require authentication)

#### Get Athlete Completion Report

```
GET /api/v1/profiles/completion-report/{athleteId}
```

Response:

```json
{
  "success": true,
  "data": {
    "athlete": {
      "id": "64a7b123456789abcdef1234",
      "name": "John Smith",
      "email": "john@example.com"
    },
    "completion": {
      "isComplete": false,
      "missingFields": ["Profile Image", "Performance Metrics"],
      "completionPercentage": 50,
      "criticalFieldsMissing": ["profileImageUrl", "metrics"]
    },
    "recommendations": [
      "Upload a professional profile photo to make a great first impression",
      "Add performance metrics (40-yard dash, bench press, etc.) to showcase your athletic abilities"
    ],
    "priority": "medium"
  }
}
```

## Configuration

### Schedule Settings

- **Frequency**: Daily at 9:00 AM
- **Timezone**: `America/Los_Angeles`
- **Cooldown**: 7 days between alerts for the same athlete

### Completion Criteria

The system checks for these required fields:

1. **Profile Image** (`profileImageUrl`): Must be a non-empty string
2. **Metrics** (`metrics`): Must be a non-empty Map/object with performance data
3. **Measurements** (`measurements`): Must be a non-empty Map/object with physical measurements
4. **Resume**: Must have at least one experience entry in ResumeProfile

## Event System

The scheduler integrates with the existing event bus system:

### Events Emitted

#### `athlete.profile.completion.alert`

```typescript
{
  athleteId: string,
  userId: string,
  athleteName: string,
  email: string,
  completionPercentage: number,
  missingFields: string[],
  criticalFieldsMissing: string[],
  profileId: string
}
```

## Implementation Status

### ✅ Completed

- Cron job setup with node-cron
- Database queries for incomplete profiles
- Profile completion analysis logic
- In-app notification creation
- Event emission for potential email notifications
- API endpoints for manual triggers and monitoring
- Admin and user routes
- Integration with existing notification system

### 🚧 TODO (Future Implementation)

- **Email Notifications**: Extend to send email when profiles are incomplete
- **Completion Tips**: Add contextual tips for each missing field
- **Progress Tracking**: Track completion progress over time
- **Gamification**: Add achievement badges for profile completion
- **Custom Schedules**: Allow users to set preferred reminder times
- **A/B Testing**: Test different message formats for better engagement

## Usage Examples

### Enable Profile Completion Monitoring

The scheduler runs automatically for all athletes. No configuration needed.

### Manual Testing

```javascript
// Manually trigger alert for testing
POST /api/v1/profiles/scheduler/trigger/64a7b123456789abcdef1234
```

### Check Athlete Completion Status

```javascript
// Get detailed completion report
GET /api/v1/profiles/completion-report/64a7b123456789abcdef1234
```

## Monitoring and Debugging

### Logs

The system provides comprehensive logging:

```
[AthleteScheduler] Starting athlete profile completion alert process...
[AthleteScheduler] Found 45 incomplete athlete profiles
[AthleteProfileCompletion] Sending completion alert for athlete: John Smith (ID: 64a7b...)
[AthleteProfileCompletion] Notification created for athlete: John Smith
[AthleteScheduler] Profile completion alerts completed. Success: 42, Errors: 3
```

### Error Handling

- Individual alert failures don't stop the entire process
- Comprehensive error logging for debugging
- Status endpoint shows system health and statistics

## Integration Points

### With Existing Systems

1. **Notification System**: Uses existing `Notification.insertNotification()`
2. **Event Bus**: Integrates with `eventBus.publish()`
3. **Authentication**: Uses existing `AuthMiddleware`
4. **Database**: Works with existing `AthleteModel` and `ResumeProfile`
5. **Cron Jobs**: Integrates with existing `cronjobs.ts`

### Future Integrations

1. **Email Service**: Can be extended to use existing `EmailService`
2. **Analytics**: Can track completion rates and user engagement
3. **Mobile Push**: Can extend to mobile push notifications
4. **Dashboard**: Frontend dashboard for completion statistics

## Testing

### Manual Testing Commands

```bash
# Check scheduler status
curl -X GET http://localhost:5000/api/v1/profiles/scheduler/status

# Trigger all alerts (admin only)
curl -X POST http://localhost:5000/api/v1/profiles/scheduler/trigger/all

# Get incomplete profiles
curl -X GET http://localhost:5000/api/v1/profiles/scheduler/incomplete?page=1&limit=10

# Get athlete completion report
curl -X GET http://localhost:5000/api/v1/profiles/completion-report/64a7b123456789abcdef1234
```

### Database Testing

```javascript
// Create a test athlete with incomplete profile
db.athleteprofiles.insertOne({
  userId: ObjectId('64a7b123456789abcdef1234'),
  fullName: 'Test Athlete',
  isActive: true,
  createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
  // Missing: profileImageUrl, metrics, measurements
});
```

## Performance Considerations

- The cron job includes a lock mechanism to prevent overlapping runs
- Individual alert failures are isolated and logged
- Database queries are optimized with indexes on `isActive` and `createdAt`
- Memory usage is managed by processing athletes sequentially
- 7-day cooldown prevents notification spam

## Security

- Admin endpoints require `admin` or `developer` roles
- User endpoints verify authentication
- Input validation on all athlete IDs
- No sensitive data exposed in completion reports
