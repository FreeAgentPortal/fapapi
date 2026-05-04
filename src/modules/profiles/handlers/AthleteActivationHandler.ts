import { AthleteModel, IAthlete } from '../athlete/models/AthleteModel';

export class AthleteActivationHandler {
  /**
   * Check if an athlete profile has done zero work (all required fields are empty/missing)
   */
  public static isZeroWorkProfile(profile: any): boolean {
    const hasProfileImage = profile.profileImageUrl && profile.profileImageUrl.trim() !== '';
    const hasMetrics = profile.metrics && Object.keys(profile.metrics).length > 0;
    const hasMeasurements = profile.measurements && Object.keys(profile.measurements).length > 0;
    const hasResume = profile.resumeData && profile.resumeData.length > 0;

    // Profile has done zero work if ALL required fields are missing/empty
    return !hasProfileImage && !hasMetrics && !hasMeasurements && !hasResume;
  }

  /**
   * Get athlete profiles that should be deactivated (older than 1 day with zero work)
   */
  public static async getProfilesForDeactivation(): Promise<IAthlete[]> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const profilesToDeactivate = await AthleteModel.aggregate([
        {
          $match: {
            isActive: true,
            createdAt: { $lt: oneDayAgo }, // Older than 1 day
          },
        },
        {
          $lookup: {
            from: 'resumeprofiles',
            let: { athleteId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$owner.kind', 'AthleteProfile'] }, { $eq: ['$owner.ref', '$$athleteId'] }],
                  },
                },
              },
            ],
            as: 'resumeData',
          },
        },
        {
          $lookup: {
            from: 'users',
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
          $match: {
            // Must have ALL required fields missing/empty (zero work done)
            $and: [
              // No profile image OR empty profile image
              {
                $or: [{ profileImageUrl: { $exists: false } }, { profileImageUrl: null }, { profileImageUrl: '' }],
              },
              // No metrics OR empty metrics
              {
                $or: [{ metrics: { $exists: false } }, { metrics: null }, { $expr: { $eq: [{ $size: { $objectToArray: '$metrics' } }, 0] } }],
              },
              // No measurements OR empty measurements
              {
                $or: [{ measurements: { $exists: false } }, { measurements: null }, { $expr: { $eq: [{ $size: { $objectToArray: '$measurements' } }, 0] } }],
              },
              // No resume
              { $expr: { $eq: [{ $size: '$resumeData' }, 0] } },
            ],
          },
        },
      ]);

      return profilesToDeactivate as IAthlete[];
    } catch (error) {
      console.error('[AthleteActivation] Error fetching profiles for deactivation:', error);
      throw error;
    }
  }

  /**
   * Get inactive athlete profiles that should be reactivated (completed profiles)
   */
  public static async getProfilesForReactivation(): Promise<IAthlete[]> {
    try {
      const profilesForReactivation = await AthleteModel.aggregate([
        {
          $match: {
            isActive: false, // Only inactive profiles
          },
        },
        {
          $lookup: {
            from: 'resumeprofiles',
            let: { athleteId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$owner.kind', 'AthleteProfile'] }, { $eq: ['$owner.ref', '$$athleteId'] }],
                  },
                },
              },
            ],
            as: 'resumeData',
          },
        },
        {
          $lookup: {
            from: 'users',
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
          $match: {
            // Profile is now complete (has at least one required field filled)
            $or: [
              // Has profile image
              {
                $and: [{ profileImageUrl: { $exists: true } }, { profileImageUrl: { $ne: null } }, { profileImageUrl: { $ne: '' } }],
              },
              // Has metrics
              {
                $and: [{ metrics: { $exists: true } }, { metrics: { $ne: null } }, { $expr: { $gt: [{ $size: { $objectToArray: '$metrics' } }, 0] } }],
              },
              // Has measurements
              {
                $and: [{ measurements: { $exists: true } }, { measurements: { $ne: null } }, { $expr: { $gt: [{ $size: { $objectToArray: '$measurements' } }, 0] } }],
              },
              // Has resume
              { $expr: { $gt: [{ $size: '$resumeData' }, 0] } },
            ],
          },
        },
      ]);

      return profilesForReactivation as IAthlete[];
    } catch (error) {
      console.error('[AthleteActivation] Error fetching profiles for reactivation:', error);
      throw error;
    }
  }

  /**
   * Deactivate athlete profiles that are older than 1 day with zero work done
   */
  public static async deactivateZeroWorkProfiles(): Promise<{
    successCount: number;
    errorCount: number;
    totalProcessed: number;
  }> {
    console.info('[AthleteActivation] Starting zero-work profile deactivation...');

    try {
      const profilesToDeactivate = await AthleteActivationHandler.getProfilesForDeactivation();

      if (profilesToDeactivate.length === 0) {
        console.info('[AthleteActivation] No profiles found for deactivation');
        return { successCount: 0, errorCount: 0, totalProcessed: 0 };
      }

      console.info(`[AthleteActivation] Found ${profilesToDeactivate.length} profiles to deactivate`);

      let successCount = 0;
      let errorCount = 0;

      for (const profile of profilesToDeactivate) {
        try {
          await AthleteModel.findByIdAndUpdate(profile._id, {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'Zero work completed after 24 hours',
          });

          console.info(`[AthleteActivation] Deactivated profile: ${profile._id} (${(profile.userId as any)?.fullName || 'Unknown'})`);
          successCount++;
        } catch (error) {
          console.error(`[AthleteActivation] Error deactivating profile ${profile._id}:`, error);
          errorCount++;
        }
      }

      const result = { successCount, errorCount, totalProcessed: profilesToDeactivate.length };
      console.info(`[AthleteActivation] Profile deactivation completed. Success: ${successCount}, Errors: ${errorCount}`);

      return result;
    } catch (error) {
      console.error('[AthleteActivation] Error in deactivateZeroWorkProfiles:', error);
      throw error;
    }
  }

  /**
   * Reactivate athlete profiles that have been completed
   */
  public static async reactivateCompletedProfiles(): Promise<{
    successCount: number;
    errorCount: number;
    totalProcessed: number;
  }> {
    console.info('[AthleteActivation] Starting completed profile reactivation...');

    try {
      const profilesToReactivate = await AthleteActivationHandler.getProfilesForReactivation();

      if (profilesToReactivate.length === 0) {
        console.info('[AthleteActivation] No profiles found for reactivation');
        return { successCount: 0, errorCount: 0, totalProcessed: 0 };
      }

      console.info(`[AthleteActivation] Found ${profilesToReactivate.length} profiles to reactivate`);

      let successCount = 0;
      let errorCount = 0;

      for (const profile of profilesToReactivate) {
        try {
          await AthleteModel.findByIdAndUpdate(profile._id, {
            isActive: true,
            reactivatedAt: new Date(),
            $unset: {
              deactivatedAt: 1,
              deactivationReason: 1,
            },
          });

          console.info(`[AthleteActivation] Reactivated profile: ${profile._id} (${(profile.userId as any)?.fullName || 'Unknown'})`);
          successCount++;
        } catch (error) {
          console.error(`[AthleteActivation] Error reactivating profile ${profile._id}:`, error);
          errorCount++;
        }
      }

      const result = { successCount, errorCount, totalProcessed: profilesToReactivate.length };
      console.info(`[AthleteActivation] Profile reactivation completed. Success: ${successCount}, Errors: ${errorCount}`);

      return result;
    } catch (error) {
      console.error('[AthleteActivation] Error in reactivateCompletedProfiles:', error);
      throw error;
    }
  }

  /**
   * Comprehensive profile management - deactivate zero-work profiles and reactivate completed ones
   */
  public static async manageProfileActivation(): Promise<{
    deactivation: { successCount: number; errorCount: number; totalProcessed: number };
    reactivation: { successCount: number; errorCount: number; totalProcessed: number };
  }> {
    console.info('[AthleteActivation] Starting comprehensive profile activation management...');

    try {
      // First deactivate zero-work profiles
      const deactivationResult = await AthleteActivationHandler.deactivateZeroWorkProfiles();

      // Then reactivate completed profiles
      const reactivationResult = await AthleteActivationHandler.reactivateCompletedProfiles();

      const result = {
        deactivation: deactivationResult,
        reactivation: reactivationResult,
      };

      console.info('[AthleteActivation] Profile activation management completed:', result);
      return result;
    } catch (error) {
      console.error('[AthleteActivation] Error in manageProfileActivation:', error);
      throw error;
    }
  }
}
