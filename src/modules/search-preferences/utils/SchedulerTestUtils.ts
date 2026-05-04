import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SearchPreferences from '../models/SearchPreferences';
import { ReportSchedulerCron } from '../cron/ReportScheduler.cron';
import { SchedulerHandler } from '../handlers/Scheduler.handler';

dotenv.config(); // Load environment variables

/**
 * Test script for the Search Preferences Report Scheduler
 * This script demonstrates how to create search preferences and test the reporting system
 */

export class SchedulerTestUtils {
  /**
   * Create a test search preference for testing the scheduler
   */
  static async createTestSearchPreference(
    ownerId: string,
    config: {
      name: string;
      frequencyType: 'daily' | 'weekly' | 'monthly';
      frequency?: number;
      positions?: string[];
      performanceMetrics?: any;
    }
  ) {
    const searchPreference = new SearchPreferences({
      ownerType: 'team',
      ownerId: new mongoose.Types.ObjectId(ownerId),
      name: config.name || 'Test Search Preference',
      description: 'Test search preference for scheduler testing',
      frequency: config.frequency || 1,
      frequencyType: config.frequencyType || 'daily',
      performanceMetrics: config.performanceMetrics,
      positions: config.positions || ['Forward', 'Midfielder'],
      ageRange: { min: 18, max: 30 },
      tags: ['test', 'automated'],
      dateLastRan: null, // Will be due for next run
    });

    await searchPreference.save();
    console.info(`Created test search preference: ${searchPreference._id}`);
    return searchPreference;
  }

  /**
   * Test the report generation for a specific search preference
   */
  static async testReportGeneration(searchPreferenceId: string) {
    try {
      console.info(`Testing report generation for preference: ${searchPreferenceId}`);

      const searchPreference = await SearchPreferences.findById(searchPreferenceId);
      if (!searchPreference) {
        throw new Error('Search preference not found');
      }

      const reportData = await SchedulerHandler.generateReport(searchPreference);

      console.info('Report generated successfully:');
      console.info(`- Report ID: ${reportData.reportId}`);
      console.info(`- Results Count: ${reportData.results.length}`);
      console.info(`- Generated At: ${reportData.generatedAt}`);

      return reportData;
    } catch (error) {
      console.error('Error testing report generation:', error);
      throw error;
    }
  }

  /**
   * Test the cron job logic without waiting for the scheduled time
   */
  static async testCronJobLogic() {
    try {
      console.info('Testing cron job logic...');

      // This will process all due search preferences
      await ReportSchedulerCron.processDailyReports();

      console.info('Cron job logic test completed');
    } catch (error) {
      console.error('Error testing cron job logic:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status for testing
   */
  static getSchedulerStatus() {
    const status = ReportSchedulerCron.getStatus();
    console.info('Scheduler Status:', status);
    return status;
  }

  /**
   * Create multiple test search preferences with different frequencies
   */
  static async createTestDataset(ownerId: string) {
    const preferences = [];

    // Daily preference
    preferences.push(
      await this.createTestSearchPreference(ownerId, {
        name: 'Daily Halfback Search',
        frequencyType: 'daily',
        frequency: 1,
        //positions should be an array of short strings i.e. ['QB', 'RB']
        positions: ['HB'],
        // for testing purposes we should only use metrics that are defined in the athlete model
        // i.e. dash40, benchPress, verticalJump, broadJump, threeCone, shuttle
        performanceMetrics: {
          dash40: { min: 4, max: 5 },
          benchPress: { min: 20, max: 30 },
          verticalJump: { min: 30, max: 40 },
          broadJump: { min: 100, max: 120 },
          threeCone: { min: 6, max: 8 },
          shuttle: { min: 4, max: 5 },
        },
      })
    );

    // daily quarterback preference
    preferences.push(
      await this.createTestSearchPreference(ownerId, {
        name: 'Daily Quarterback Search',
        frequencyType: 'daily',
        frequency: 1,
        positions: ['QB'],
        performanceMetrics: {
          dash40: { min: 4.5, max: 5.5 },
          benchPress: { min: 18, max: 24 },
          verticalJump: { min: 30, max: 36 },
          broadJump: { min: 98, max: 112 },
          threeCone: { min: 6.2, max: 7.0 },
          shuttle: { min: 4.0, max: 4.5 },
        },
      })
    );

    // Weekly preference
    preferences.push(
      await this.createTestSearchPreference(ownerId, {
        name: 'Weekly FullBack Search',
        frequencyType: 'weekly',
        frequency: 1,
        positions: ['FB'],
        performanceMetrics: {
          dash40: { min: 4.5, max: 5.5 },
          benchPress: { min: 22, max: 28 },
          verticalJump: { min: 32, max: 38 },
          broadJump: { min: 102, max: 118 },
          threeCone: { min: 6.5, max: 7.5 },
          shuttle: { min: 4.2, max: 4.8 },
        },
      })
    );

    // Monthly preference
    preferences.push(
      await this.createTestSearchPreference(ownerId, {
        name: 'Monthly multi-position Search',
        frequencyType: 'monthly',
        frequency: 1,
        positions: ['DE', 'LB', 'CB'],
        performanceMetrics: {
          dash40: { min: 4.8, max: 5.2 },
          benchPress: { min: 24, max: 26 },
          verticalJump: { min: 31, max: 35 },
          broadJump: { min: 104, max: 116 },
          threeCone: { min: 6.8, max: 7.2 },
          shuttle: { min: 4.3, max: 4.7 },
        },
      })
    );

    // Disabled preference
    preferences.push(
      await this.createTestSearchPreference(ownerId, {
        name: 'Disabled Search',
        frequencyType: 'daily',
        frequency: 0, // Disabled
        positions: ['FWD', 'MDF', 'DEF'],
      })
    );

    console.info(`Created ${preferences.length} test search preferences`);
    return preferences;
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData() {
    try {
      const result = await SearchPreferences.deleteMany({
        tags: { $in: ['test', 'automated'] },
      });

      console.info(`Cleaned up ${result.deletedCount} test search preferences`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up test data:', error);
      throw error;
    }
  }

  /**
   * Simulate a preference that's due for a report
   */
  static async makeDueForReport(searchPreferenceId: string, frequencyType: 'daily' | 'weekly' | 'monthly') {
    let daysAgo: number;

    switch (frequencyType) {
      case 'daily':
        daysAgo = 2; // 2 days ago
        break;
      case 'weekly':
        daysAgo = 8; // 8 days ago
        break;
      case 'monthly':
        daysAgo = 32; // 32 days ago
        break;
    }

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - daysAgo);

    await SearchPreferences.findByIdAndUpdate(searchPreferenceId, {
      dateLastRan: pastDate,
    });

    console.info(`Updated preference ${searchPreferenceId} to be due for ${frequencyType} report`);
  }
}

// Example usage - see runSchedulerTests.ts for a complete test runner
/*
async function runTests() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fapapi');
    
    // Create test data
    const ownerId = '6851c0b4287706b05aec95ee'; // Replace with actual user ID
    const preferences = await SchedulerTestUtils.createTestDataset(ownerId);

    // Make some preferences due for reports
    await SchedulerTestUtils.makeDueForReport(preferences[0]._id as any, 'daily');
    await SchedulerTestUtils.makeDueForReport(preferences[1]._id as any, 'weekly');

    // Test the cron job logic
    await SchedulerTestUtils.testCronJobLogic();

    // Get status
    SchedulerTestUtils.getSchedulerStatus();

    // Clean up
    await SchedulerTestUtils.cleanupTestData();

    console.info('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}
*/
