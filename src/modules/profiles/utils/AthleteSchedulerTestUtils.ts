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
      console.log(`Testing completion alert for athlete: ${athleteId}`);

      const athlete = await AthleteModel.findById(athleteId).populate('userId', 'email firstName lastName fullName');
      if (!athlete) {
        throw new Error('Athlete not found');
      }

      const completionStatus = await AthleteProfileCompletionHandler.checkProfileCompletion(athlete);
      const shouldSend = await AthleteProfileCompletionHandler.shouldSendAlert(athlete);

      console.log('Athlete Details:');
      console.log(`- Name: ${athlete.fullName}`);
      console.log(`- Email: ${(athlete as any).userId?.email || athlete.email}`);
      console.log(`- Created: ${athlete.createdAt}`);

      console.log('\nCompletion Status:');
      console.log(`- Complete: ${completionStatus.isComplete}`);
      console.log(`- Completion %: ${completionStatus.completionPercentage}%`);
      console.log(`- Missing Fields: ${completionStatus.missingFields.join(', ')}`);
      console.log(`- Should Send Alert: ${shouldSend}`);

      if (shouldSend && !completionStatus.isComplete) {
        await AthleteProfileCompletionHandler.sendCompletionAlert(athlete);
        console.log('\n✅ Alert sent successfully!');
      } else {
        console.log('\n⏸️ Alert not sent (complete or recent alert exists)');
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
      console.log('Testing scheduler process...');

      const statistics = await AthleteProfileAnalysisHandler.getCompletionStatistics();
      const status = AthleteSchedulerCron.getStatus();

      console.log('\nScheduler Status:');
      console.log(`- Running: ${status.isRunning}`);
      console.log(`- Next Run: ${status.nextRun}`);

      console.log('\nCompletion Statistics:');
      console.log(`- Total Athletes: ${statistics.totalAthletes}`);
      console.log(`- Incomplete Profiles: ${statistics.incompleteProfiles}`);
      console.log(`- Completion Rate: ${statistics.completionRate}%`);
      console.log('\nMissing Fields:');
      console.log(`- Profile Images: ${statistics.missingFields.profileImage}`);
      console.log(`- Metrics: ${statistics.missingFields.metrics}`);
      console.log(`- Measurements: ${statistics.missingFields.measurements}`);
      console.log(`- Resumes: ${statistics.missingFields.resume}`);

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
      console.log(`Getting ${limit} incomplete athletes for testing...`);

      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();
      const limitedProfiles = incompleteProfiles.slice(0, limit);

      console.log(`\nFound ${limitedProfiles.length} incomplete athletes:`);

      const athletesWithStatus = await Promise.all(
        limitedProfiles.map(async (athlete) => {
          const completionStatus = await AthleteProfileCompletionHandler.checkProfileCompletion(athlete);
          console.log(`- ${athlete.fullName}: ${completionStatus.completionPercentage}% complete`);
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
      console.log(`Creating test incomplete athlete: ${name}`);

      // Create a basic athlete without required fields
      const athlete = await AthleteModel.create({
        fullName: name,
        isActive: true,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        // Intentionally missing: profileImageUrl, metrics, measurements
      });

      console.log(`✅ Created test athlete: ${athlete._id}`);
      console.log('Missing fields: Profile Image, Metrics, Measurements, Resume');

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
      console.log('Running dry run of completion alert process...');

      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();

      console.log(`\nFound ${incompleteProfiles.length} incomplete profiles`);

      let wouldSendCount = 0;
      let recentAlertCount = 0;

      for (const profile of incompleteProfiles) {
        const shouldSend = await AthleteProfileCompletionHandler.shouldSendAlert(profile);
        if (shouldSend) {
          wouldSendCount++;
          console.log(`✉️  Would send alert to: ${profile.fullName}`);
        } else {
          recentAlertCount++;
          console.log(`⏸️  Would skip (recent alert): ${profile.fullName}`);
        }
      }

      console.log(`\n📊 Dry Run Summary:`);
      console.log(`- Total Incomplete: ${incompleteProfiles.length}`);
      console.log(`- Would Send Alerts: ${wouldSendCount}`);
      console.log(`- Would Skip (Recent): ${recentAlertCount}`);

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
      console.log('Testing AthleteProfileAnalysisHandler methods...');

      // Test getting incomplete profiles
      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();
      console.log(`✅ getIncompleteAthleteProfiles: Found ${incompleteProfiles.length} profiles`);

      // Test pagination
      const paginatedResult = await AthleteProfileAnalysisHandler.getIncompleteProfilesWithPagination(1, 5);
      console.log(`✅ getIncompleteProfilesWithPagination: ${paginatedResult.profiles.length}/${paginatedResult.total} profiles (page 1)`);

      // Test statistics
      const statistics = await AthleteProfileAnalysisHandler.getCompletionStatistics();
      console.log(`✅ getCompletionStatistics: ${statistics.completionRate}% completion rate`);

      // Test process completion alerts (dry run)
      console.log('\nTesting processCompletionAlerts (this will actually send alerts)...');
      const processResult = await AthleteProfileAnalysisHandler.processCompletionAlerts();
      console.log(`✅ processCompletionAlerts: Success=${processResult.successCount}, Errors=${processResult.errorCount}, Skipped=${processResult.skippedCount}`);

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
