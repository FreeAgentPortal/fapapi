import { ModelKey, ModelMap } from '../../../utils/ModelMap';
import { AthleteModel, IAthlete } from '../athlete/models/AthleteModel';
import { AthleteProfileCompletionHandler } from './AthleteProfileCompletionHandler';

export class AthleteProfileAnalysisHandler {
  private modelMap: Record<ModelKey, any> = ModelMap;
  /**
   * Get athlete profiles that are incomplete
   * Based on missing: profileImageUrl, metrics, measurements, and resume
   */
  public static async getIncompleteAthleteProfiles(): Promise<IAthlete[]> {
    try {
      // Use aggregation to check for missing fields including resume
      const incompleteProfiles = await AthleteModel.aggregate([
        {
          $lookup: {
            from: 'resumeprofiles', // MongoDB collection name (plural, lowercase)
            let: { athleteId: '$_id' }, // Pass athlete ID as variable
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$owner.kind', 'AthleteProfile'] }, // Must be AthleteProfile type
                      { $eq: ['$owner.ref', '$$athleteId'] }, // Must match the athlete ID
                    ],
                  },
                },
              },
            ],
            as: 'resumeData',
          },
        },
        {
          $lookup: {
            from: 'users', // Populate userId
            localField: 'userId',
            foreignField: '_id',
            as: 'userId',
            pipeline: [
              {
                $project: {
                  email: 1,
                  firstName: 1,
                  lastName: 1,
                  isEmailVerified: 1,
                  fullName: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$userId',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            isActive: true,
            createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // exclude accounts created within the last 24 hours
            // exclude accounts that have not verified their email
            'userId.isEmailVerified': true,

            // Must be missing at least one key field
            $or: [
              // Missing profile image
              { profileImageUrl: { $exists: false } },
              { profileImageUrl: null },
              { profileImageUrl: '' },
              // Missing metrics (empty or doesn't exist)
              { metrics: { $exists: false } },
              { metrics: null },
              { $expr: { $eq: [{ $size: { $objectToArray: '$metrics' } }, 0] } },
              // Missing measurements (empty or doesn't exist)
              { measurements: { $exists: false } },
              { measurements: null },
              { $expr: { $eq: [{ $size: { $objectToArray: '$measurements' } }, 0] } },
              // Missing resume (empty array)
              { $expr: { $eq: [{ $size: '$resumeData' }, 0] } },
            ],
          },
        },
      ]);

      return incompleteProfiles as IAthlete[];
    } catch (error) {
      console.error('[AthleteProfileAnalysis] Error fetching incomplete athlete profiles:', error);
      throw error;
    }
  }

  /**
   * Process completion alerts for incomplete athlete profiles
   */
  public static async processCompletionAlerts(): Promise<{
    successCount: number;
    errorCount: number;
    skippedCount: number;
    totalProcessed: number;
  }> {
    console.info('[AthleteProfileAnalysis] Starting profile completion alert process...');

    try {
      // Get all athlete profiles that are incomplete
      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();

      if (incompleteProfiles.length === 0) {
        console.info('[AthleteProfileAnalysis] No incomplete athlete profiles found');
        return { successCount: 0, errorCount: 0, skippedCount: 0, totalProcessed: 0 };
      }

      console.info(`[AthleteProfileAnalysis] Found ${incompleteProfiles.length} incomplete athlete profiles\n`);

      // Process each incomplete profile
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const profile of incompleteProfiles) {
        try {
          // Check if we should send alert (to avoid spamming)
          const shouldSend = await AthleteProfileCompletionHandler.shouldSendAlert(profile);
          if (!shouldSend) {
            console.info(`[AthleteProfileAnalysis] Skipping alert for ${profile.fullName} - recent alert already sent`);
            skippedCount++;
            continue;
          }

          await AthleteProfileCompletionHandler.sendCompletionAlert(profile);
          successCount++;
        } catch (error) {
          console.error(`[AthleteProfileAnalysis] Error sending completion alert for profile ${profile._id}:`, error);
          errorCount++;
        }
      }

      const result = {
        successCount,
        errorCount,
        skippedCount,
        totalProcessed: incompleteProfiles.length,
      };

      console.info(`[AthleteProfileAnalysis] Profile completion alerts completed. Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);

      return result;
    } catch (error) {
      console.error('[AthleteProfileAnalysis] Error in processCompletionAlerts:', error);
      throw error;
    }
  }

  /**
   * Process completion alert for a specific athlete
   */
  public static async processSpecificAthleteAlert(athleteId: string): Promise<void> {
    console.info(`[AthleteProfileAnalysis] Processing completion alert for specific athlete: ${athleteId}`);

    try {
      // Find the athlete
      const athlete = await AthleteModel.findById(athleteId).populate('userId', 'email firstName lastName fullName');
      if (!athlete) {
        throw new Error(`Athlete profile not found: ${athleteId}`);
      }

      // Send the completion alert
      await AthleteProfileCompletionHandler.sendCompletionAlert(athlete);
      console.info(`[AthleteProfileAnalysis] Completion alert sent successfully for athlete: ${athleteId}`);
    } catch (error) {
      console.error(`[AthleteProfileAnalysis] Error processing specific athlete alert for ${athleteId}:`, error);
      throw error;
    }
  }

  /**
   * Get profile completion statistics
   */
  public static async getCompletionStatistics(): Promise<{
    totalAthletes: number;
    incompleteProfiles: number;
    completionRate: number;
    missingFields: {
      profileImage: number;
      metrics: number;
      measurements: number;
      resume: number;
    };
  }> {
    try {
      const totalAthletes = await AthleteModel.countDocuments({ isActive: true });
      const incompleteProfiles = await AthleteProfileAnalysisHandler.getIncompleteAthleteProfiles();

      // Count missing fields from the already retrieved data
      const missingProfileImage = incompleteProfiles.filter((a) => !a.profileImageUrl || a.profileImageUrl === '').length;

      const missingMetrics = incompleteProfiles.filter((a) => !a.metrics || Object.keys(a.metrics).length === 0).length;

      const missingMeasurements = incompleteProfiles.filter((a) => !a.measurements || Object.keys(a.measurements).length === 0).length;

      // Count missing resume from the already retrieved data (resumeData is included in the aggregation)
      // Note: getIncompleteAthleteProfiles() already includes resumeData lookup, so we can check it directly
      const missingResumeCount = incompleteProfiles.filter((a: any) => !a.resumeData || a.resumeData.length === 0).length;

      const completionRate = totalAthletes > 0 ? ((totalAthletes - incompleteProfiles.length) / totalAthletes) * 100 : 100;

      return {
        totalAthletes,
        incompleteProfiles: incompleteProfiles.length,
        completionRate: Math.round(completionRate * 100) / 100,
        missingFields: {
          profileImage: missingProfileImage,
          metrics: missingMetrics,
          measurements: missingMeasurements,
          resume: missingResumeCount,
        },
      };
    } catch (error) {
      console.error('[AthleteProfileAnalysis] Error getting completion statistics:', error);
      throw error;
    }
  }

  /**
   * Get athletes with incomplete profiles for listing/pagination
   */
  public static async getIncompleteProfilesWithPagination(
    page: number = 1,
    limit: number = 20
  ): Promise<{
    profiles: IAthlete[];
    total: number;
    pages: number;
  }> {
    try {
      // Use aggregation to check for missing fields including resume
      const aggregationPipeline = [
        {
          $match: {
            isActive: true,
            createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
        {
          $lookup: {
            from: 'resumeprofiles', // MongoDB collection name (plural, lowercase)
            let: { athleteId: '$_id' }, // Pass athlete ID as variable
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$owner.kind', 'AthleteProfile'] }, // Must be AthleteProfile type
                      { $eq: ['$owner.ref', '$$athleteId'] }, // Must match the athlete ID
                    ],
                  },
                },
              },
            ],
            as: 'resumeData',
          },
        },
        {
          $match: {
            // Must be missing at least one key field
            $or: [
              { profileImageUrl: { $exists: false } },
              { profileImageUrl: null },
              { profileImageUrl: '' },
              { metrics: { $exists: false } },
              { metrics: null },
              { $expr: { $eq: [{ $size: { $objectToArray: '$metrics' } }, 0] } },
              { measurements: { $exists: false } },
              { measurements: null },
              { $expr: { $eq: [{ $size: { $objectToArray: '$measurements' } }, 0] } },
              // Missing resume (empty array)
              { $expr: { $eq: [{ $size: '$resumeData' }, 0] } },
            ],
          },
        },
        {
          $lookup: {
            from: 'users', // Populate userId
            localField: 'userId',
            foreignField: '_id',
            as: 'userId',
            pipeline: [
              {
                $project: {
                  email: 1,
                  firstName: 1,
                  lastName: 1,
                  fullName: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$userId',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            resumeData: 0, // Remove the resume data from results to keep it clean
          },
        },
      ];

      // Get total count using the same pipeline
      const totalPipeline = [...aggregationPipeline, { $count: 'total' }];
      const totalResult = await AthleteModel.aggregate(totalPipeline);
      const total = totalResult[0]?.total || 0;

      // Get paginated results
      const profilesPipeline = [...aggregationPipeline, { $sort: { createdAt: -1 as const } }, { $skip: (page - 1) * limit }, { $limit: limit }];

      const profiles = await AthleteModel.aggregate(profilesPipeline);

      return {
        profiles: profiles as IAthlete[],
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('[AthleteProfileAnalysis] Error getting paginated incomplete profiles:', error);
      throw error;
    }
  }
}
