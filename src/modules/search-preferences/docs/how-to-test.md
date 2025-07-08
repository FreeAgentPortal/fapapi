# How to Run Search Preferences Scheduler Tests

This guide explains different ways to test the Search Preferences Report Scheduler system.

## Prerequisites

1. Make sure your MongoDB is running
2. Ensure your `.env` file is properly configured with `MONGODB_URI`
3. Have a valid user ID to use for testing (replace `6851c0b4287706b05aec95ee` in the test files)

## Method 1: Using npm script (Recommended)

The easiest way to run the tests:

```bash
npm run test:scheduler
```

This will run the complete test suite including:

- ✅ MongoDB connection
- ✅ Create test search preferences
- ✅ Mark some as due for reports
- ✅ Test individual report generation
- ✅ Test cron job logic
- ✅ Check scheduler status
- ✅ Clean up test data

## Method 2: Using ts-node directly

You can run the test file directly using ts-node:

```bash
npx ts-node src/modules/search-preferences/utils/runSchedulerTests.ts
```

Or if ts-node is installed globally:

```bash
ts-node src/modules/search-preferences/utils/runSchedulerTests.ts
```

## Method 3: Using the utility class programmatically

Import and use the `SchedulerTestUtils` class in your own scripts:

```typescript
import { SchedulerTestUtils } from './path/to/SchedulerTestUtils';
import mongoose from 'mongoose';

async function myTest() {
  await mongoose.connect(process.env.MONGODB_URI!);

  // Create a single test preference
  const preference = await SchedulerTestUtils.createTestSearchPreference('userId', {
    name: 'My Test Search',
    frequencyType: 'daily',
  });

  // Test report generation
  await SchedulerTestUtils.testReportGeneration(preference._id as string);

  // Clean up
  await SchedulerTestUtils.cleanupTestData();
  await mongoose.connection.close();
}
```

## Method 4: Manual testing via API endpoints

Start your server and use the API endpoints:

```bash
# Start the server
npm run dev

# Check scheduler status (admin only)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:5000/api/v1/search-preferences/scheduler/status

# Trigger all reports manually (admin only)
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:5000/api/v1/search-preferences/scheduler/trigger/all

# Get user's search preferences (authenticated user)
curl -H "Authorization: Bearer YOUR_USER_TOKEN" \
     http://localhost:5000/api/v1/search-preferences/scheduler/preferences
```

## Method 5: Build and run as JavaScript

If you prefer to compile TypeScript first:

```bash
# Build the TypeScript
npm run build

# Run the compiled JavaScript (you'll need to create a .js version)
node dist/modules/search-preferences/utils/runSchedulerTests.js
```

## Test Configuration

### Update User ID

Before running tests, update the user ID in the test files:

```typescript
// In runSchedulerTests.ts, line ~30
const ownerId = 'YOUR_ACTUAL_USER_ID_HERE'; // Replace this
```

### MongoDB Connection

Ensure your `.env` file has the correct MongoDB URI:

```env
MONGODB_URI=mongodb://localhost:27017/fapapi
# or your remote MongoDB connection string
```

## Expected Output

When running the tests successfully, you should see output like:

```
🚀 Starting Search Preferences Scheduler Tests...

📦 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Test 1: Getting scheduler status...
Scheduler Status: { isRunning: false, nextRun: 2025-07-08T07:00:00.000Z }
✅ Status check completed

📝 Test 2: Creating test search preferences...
Created test search preference: 64a7b123456789abcdef1234
Created test search preference: 64a7b123456789abcdef1235
Created test search preference: 64a7b123456789abcdef1236
Created test search preference: 64a7b123456789abcdef1237
Created 4 test search preferences
✅ Test dataset created

⏰ Test 3: Making preferences due for reports...
Updated preference 64a7b123456789abcdef1234 to be due for daily report
Updated preference 64a7b123456789abcdef1235 to be due for weekly report
✅ Preferences marked as due

📊 Test 4: Testing individual report generation...
[Scheduler] Generating report for search preference: Daily Forward Search (ID: 64a7b...)
[Scheduler] Report generated successfully for preference: Daily Forward Search
Report generated successfully:
- Report ID: report_64a7b123456789abcdef1234_1720742400000
- Results Count: 2
- Generated At: 2025-07-07T...
✅ Individual report test completed

🔄 Test 5: Testing cron job logic...
[ReportScheduler] Starting daily report generation process...
[ReportScheduler] Found 2 search preferences due for reports
[ReportScheduler] Daily report generation completed. Success: 2, Errors: 0
✅ Cron job logic test completed

🧹 Cleaning up test data...
Cleaned up 4 test search preferences
✅ Cleanup completed

🎉 All tests completed successfully!
📦 MongoDB connection closed
```

## Troubleshooting

### Error: "Cannot use import statement outside a module"

This means you're trying to run a TypeScript file with regular `node`. Use one of these solutions:

1. Use `ts-node` instead: `npx ts-node your-file.ts`
2. Use the npm script: `npm run test:scheduler`
3. Compile to JavaScript first: `npm run build` then run the .js file

### Error: "Module not found"

Make sure you're running the command from the project root directory (where package.json is located).

### Error: "MongoDB connection failed"

1. Check that MongoDB is running
2. Verify your `MONGODB_URI` in the `.env` file
3. Ensure the database name matches your project configuration

### Error: "User not found" or authentication issues

1. Update the `ownerId` in the test files with a valid user ID from your database
2. For API testing, ensure you have valid authentication tokens

## Quick Start Commands

```bash
# Clone the project and install dependencies (if not done)
npm install

# Run the scheduler tests
npm run test:scheduler

# Or run with ts-node directly
npx ts-node src/modules/search-preferences/utils/runSchedulerTests.ts
```

That's it! The test system will create sample data, test the scheduler logic, and clean up after itself.
