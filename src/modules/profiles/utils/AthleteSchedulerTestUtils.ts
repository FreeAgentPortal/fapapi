import { AthleteSchedulerCron } from '../cron/AthleteScheduler.cron';
import { AthleteProfileCompletionHandler } from '../handlers/AthleteProfileCompletionHandler';
import { AthleteProfileAnalysisHandler } from '../handlers/AthleteProfileAnalysisHandler';
import { AthleteModel } from '../athlete/models/AthleteModel';

export class AthleteSchedulerTestUtils {
  /**
   * Test the completion alert for a specific athlete
   */
  static async testCompletionAlert(athleteId: string) {
    try {
      console.info(`Testing completion alert for athlete: ${athleteId}`);

      const athlete = await AthleteModel.findById(athleteId).populate('userId', 'email firstName lastName fullName');
      if (!athlete) {
        throw new Error('Athlete not found');
      }

      const completionStatus = await AthleteProfileCompletionHandler.checkProfileCompletion(athlete);
      const shouldSend = await AthleteProfileCompletionHandler.shouldSendAlert(athlete);

      console.info('Athlete Details:');
      console.info(`- Name: ${athlete.fullName}`);
      console.info(`- Email: ${(athlete as any).userId?.email || athlete.email}`);
      console.info(`- Created: ${athlete.createdAt}`);

      console.info('\nCompletion Status:');
      console.info(`- Complete: ${completionStatus.isComplete}`);
      console.info(`- Completion %: ${completionStatus.completionPercentage}%`);
      console.info(`- Missing Fields: ${completionStatus.missingFields.join(', ')}`);
      console.info(`- Should Send Alert: ${shouldSend}`);

      if (shouldSend && !completionStatus.isComplete) {
        await AthleteProfileCompletionHandler.sendCompletionAlert(athlete);
        console.info('\n✅ Alert sent successfully!');
      } else {
        console.info('\n⏸️ Alert not sent (complete or recent alert exists)');
      }

      return {
        athlete: {
          id: athlete._id,
          name: athlete.fullName,
          email: (athlete as any).userId?.email || athlete.email,
        },
        completion: completionStatus,
        shouldSendAlert: shouldSend,
      };
    } catch (error) {
      console.error('Error testing completion alert:', error);
      throw error;
    }
  }

  /**
   * Test the full scheduler process without actually running it
   */
  static async testSchedulerProcess() {
    try {
      console.info('Testing scheduler process...');

      const statistics = await AthleteProfileAnalysisHandler.getCompletionStatistics();
      const status = AthleteSchedulerCron.getStatus();

      console.info('\nScheduler Status:');
      console.info(`- Running: ${status.isRunning}`);
      console.info(`- Next Run: ${status.nextRun}`);

      console.info('\nCompletion Statistics:');
      console.info(`- Total Athletes: ${statistics.totalAthletes}`);
      console.info(`- Incomplete Profiles: ${statistics.incompleteProfiles}`);
      console.info(`- Completion Rate: ${statistics.completionRate}%`);
      console.info('\nMissing Fields:');
      console.info(`- Profile Images: ${statistics.missingFields.profileImage}`);
      console.info(`- Metrics: ${statistics.missingFields.metrics}`);
      console.info(`- Measurements: ${statistics.missingFields.measurements}`);
      console.info(`- Resumes: ${statistics.missingFields.resume}`);

      return { status, statistics };
    } catch (error) {
      console.error('Error testing scheduler process:', error);
      throw error;
    }
  }

  /**
   * Get a list of incomplete athletes for testing
   */
  static async getIncompleteAthletesForTesting(limit: number = 5) {
    try {
      console.info(`Getting ${limit} incomplete athletes for testing...`);

      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();
      const limitedProfiles = incompleteProfiles.slice(0, limit);

      console.info(`\nFound ${limitedProfiles.length} incomplete athletes:`);

      const athletesWithStatus = await Promise.all(
        limitedProfiles.map(async (athlete) => {
          const completionStatus = await AthleteProfileCompletionHandler.checkProfileCompletion(athlete);
          console.info(`- ${athlete.fullName}: ${completionStatus.completionPercentage}% complete`);
          return {
            ...athlete,
            completion: completionStatus,
          };
        })
      );

      return athletesWithStatus;
    } catch (error) {
      console.error('Error getting incomplete athletes:', error);
      throw error;
    }
  }

  /**
   * Create a test athlete with incomplete profile for testing
   */
  static async createTestIncompleteAthlete(name: string = 'Test Athlete') {
    try {
      console.info(`Creating test incomplete athlete: ${name}`);

      // Create a basic athlete without required fields
      const athlete = await AthleteModel.create({
        fullName: name,
        isActive: true,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        // Intentionally missing: profileImageUrl, metrics, measurements
      });

      console.info(`✅ Created test athlete: ${athlete._id}`);
      console.info('Missing fields: Profile Image, Metrics, Measurements, Resume');

      return athlete;
    } catch (error) {
      console.error('Error creating test athlete:', error);
      throw error;
    }
  }

  /**
   * Run a dry run of the completion alert process
   */
  static async dryRunCompletionAlerts() {
    try {
      console.info('Running dry run of completion alert process...');

      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();

      console.info(`\nFound ${incompleteProfiles.length} incomplete profiles`);

      let wouldSendCount = 0;
      let recentAlertCount = 0;

      for (const profile of incompleteProfiles) {
        const shouldSend = await AthleteProfileCompletionHandler.shouldSendAlert(profile);
        if (shouldSend) {
          wouldSendCount++;
          console.info(`✉️  Would send alert to: ${profile.fullName}`);
        } else {
          recentAlertCount++;
          console.info(`⏸️  Would skip (recent alert): ${profile.fullName}`);
        }
      }

      console.info(`\n📊 Dry Run Summary:`);
      console.info(`- Total Incomplete: ${incompleteProfiles.length}`);
      console.info(`- Would Send Alerts: ${wouldSendCount}`);
      console.info(`- Would Skip (Recent): ${recentAlertCount}`);

      return {
        totalIncomplete: incompleteProfiles.length,
        wouldSend: wouldSendCount,
        wouldSkip: recentAlertCount,
      };
    } catch (error) {
      console.error('Error in dry run:', error);
      throw error;
    }
  }

  /**
   * Test the new analysis handler methods
   */
  static async testAnalysisHandler() {
    try {
      console.info('Testing AthleteProfileAnalysisHandler methods...');

      // Test getting incomplete profiles
      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();
      console.info(`✅ getIncompleteAthleteProfiles: Found ${incompleteProfiles.length} profiles`);

      // Test pagination
      const paginatedResult = await AthleteProfileAnalysisHandler.getIncompleteProfilesWithPagination(1, 5);
      console.info(`✅ getIncompleteProfilesWithPagination: ${paginatedResult.profiles.length}/${paginatedResult.total} profiles (page 1)`);

      // Test statistics
      const statistics = await AthleteProfileAnalysisHandler.getCompletionStatistics();
      console.info(`✅ getCompletionStatistics: ${statistics.completionRate}% completion rate`);

      // Test process completion alerts (dry run)
      console.info('\nTesting processCompletionAlerts (this will actually send alerts)...');
      const processResult = await AthleteProfileAnalysisHandler.processCompletionAlerts();
      console.info(`✅ processCompletionAlerts: Success=${processResult.successCount}, Errors=${processResult.errorCount}, Skipped=${processResult.skippedCount}`);

      return {
        incompleteCount: incompleteProfiles.length,
        paginatedResult,
        statistics,
        processResult,
      };
    } catch (error) {
      console.error('Error testing analysis handler:', error);
      throw error;
    }
  }
}
