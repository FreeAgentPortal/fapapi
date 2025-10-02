#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SchedulerTestUtils } from './SchedulerTestUtils';
import { MONGO_URI } from '../../../config/mongouri';

// Load environment variables
dotenv.config();

/**
 * Standalone test runner for the Search Preferences Report Scheduler
 * This file can be executed directly to test the scheduler system
 */

async function main() {
  console.info('🚀 Starting Search Preferences Scheduler Tests...\n');

  try {
    // Connect to MongoDB
    console.info('📦 Connecting to MongoDB...');
    const mongoUri = MONGO_URI;
    await mongoose.connect(mongoUri);
    console.info('✅ Connected to MongoDB\n');

    // Test 1: Get initial status
    console.info('📊 Test 1: Getting scheduler status...');
    SchedulerTestUtils.getSchedulerStatus();
    console.info('✅ Status check completed\n');

    // Test 2: Create test dataset
    console.info('📝 Test 2: Creating test search preferences...');
    const ownerId = '6851c0b4287706b05aec95ee'; // Replace with actual user ID
    const preferences = await SchedulerTestUtils.createTestDataset(ownerId);
    console.info('✅ Test dataset created\n');

    // Test 3: Make some preferences due for reports
    console.info('⏰ Test 3: Making preferences due for reports...');
    await SchedulerTestUtils.makeDueForReport(preferences[0]._id as any, 'daily');
    await SchedulerTestUtils.makeDueForReport(preferences[1]._id as any, 'weekly');
    console.info('✅ Preferences marked as due\n');

    // Test 4: Test individual report generation
    console.info('📊 Test 4: Testing individual report generation...');
    await SchedulerTestUtils.testReportGeneration(preferences[0]._id as any);
    console.info('✅ Individual report test completed\n');

    // Test 5: Test the cron job logic
    console.info('🔄 Test 5: Testing cron job logic...');
    await SchedulerTestUtils.testCronJobLogic();
    console.info('✅ Cron job logic test completed\n');

    // Test 6: Final status check
    console.info('📊 Test 6: Final status check...');
    SchedulerTestUtils.getSchedulerStatus();
    console.info('✅ Final status check completed\n');

    // Clean up test data
    console.info('🧹 Cleaning up test data...');
    await SchedulerTestUtils.cleanupTestData();
    console.info('✅ Cleanup completed\n');

    console.info('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.info('📦 MongoDB connection closed');
    process.exit(0);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}
