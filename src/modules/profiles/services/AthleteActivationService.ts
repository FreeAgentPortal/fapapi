import { Request, Response } from 'express';
import { AthleteActivationSchedulerCron } from '../cron/AthleteActivationScheduler.cron';
import { AthleteActivationHandler } from '../handlers/AthleteActivationHandler';
import error from '../../../middleware/error';

export class AthleteActivationService {
  /**
   * Get the status of the athlete activation scheduler
   */
  public static async getActivationSchedulerStatus(req: Request, res: Response): Promise<Response> {
    try {
      const status = AthleteActivationSchedulerCron.getStatus();

      return res.status(200).json({
        success: true,
        data: {
          scheduler: status,
          description: 'Profile activation management scheduler - deactivates zero-work profiles and reactivates completed ones',
        },
      });
    } catch (err) {
      console.error('[AthleteActivationService] Error getting activation scheduler status:', err);
      return error(err, req, res);
    }
  }

  /**
   * Manually trigger complete profile activation management (deactivation + reactivation)
   */
  public static async triggerProfileManagement(req: Request, res: Response): Promise<Response> {
    try {
      console.info('[AthleteActivationService] Manual trigger for profile activation management requested');

      const result = await AthleteActivationSchedulerCron.triggerManualProfileManagement();

      return res.status(200).json({
        success: true,
        message: 'Profile activation management completed successfully',
        data: result,
      });
    } catch (err) {
      console.error('[AthleteActivationService] Error triggering profile management:', err);
      return error(err, req, res);
    }
  }

  /**
   * Manually trigger profile deactivation only
   */
  public static async triggerDeactivation(req: Request, res: Response): Promise<Response> {
    try {
      console.info('[AthleteActivationService] Manual trigger for profile deactivation requested');

      const result = await AthleteActivationSchedulerCron.triggerManualDeactivation();

      return res.status(200).json({
        success: true,
        message: 'Profile deactivation completed successfully',
        data: result,
      });
    } catch (err) {
      console.error('[AthleteActivationService] Error triggering profile deactivation:', err);
      return error(err, req, res);
    }
  }

  /**
   * Manually trigger profile reactivation only
   */
  public static async triggerReactivation(req: Request, res: Response): Promise<Response> {
    try {
      console.info('[AthleteActivationService] Manual trigger for profile reactivation requested');

      const result = await AthleteActivationSchedulerCron.triggerManualReactivation();

      return res.status(200).json({
        success: true,
        message: 'Profile reactivation completed successfully',
        data: result,
      });
    } catch (err) {
      console.error('[AthleteActivationService] Error triggering profile reactivation:', err);
      return error(err, req, res);
    }
  }

  /**
   * Get profiles that would be deactivated (for preview/analysis)
   */
  public static async getProfilesForDeactivation(req: Request, res: Response): Promise<Response> {
    try {
      const profiles = await AthleteActivationHandler.getProfilesForDeactivation();

      return res.status(200).json({
        success: true,
        message: `Found ${profiles.length} profiles eligible for deactivation`,
        data: {
          count: profiles.length,
          profiles: profiles.map((profile: any) => ({
            id: profile._id,
            name: profile.userId?.fullName || 'Unknown',
            email: profile.userId?.email || 'Unknown',
            createdAt: profile.createdAt,
            hasProfileImage: !!profile.profileImageUrl,
            hasMetrics: !!(profile.metrics && Object.keys(profile.metrics).length > 0),
            hasMeasurements: !!(profile.measurements && Object.keys(profile.measurements).length > 0),
            hasResume: !!(profile.resumeData && profile.resumeData.length > 0),
          })),
        },
      });
    } catch (err) {
      console.error('[AthleteActivationService] Error getting profiles for deactivation:', err);
      return error(err, req, res);
    }
  }

  /**
   * Get profiles that would be reactivated (for preview/analysis)
   */
  public static async getProfilesForReactivation(req: Request, res: Response): Promise<Response> {
    try {
      const profiles = await AthleteActivationHandler.getProfilesForReactivation();

      return res.status(200).json({
        success: true,
        message: `Found ${profiles.length} profiles eligible for reactivation`,
        data: {
          count: profiles.length,
          profiles: profiles.map((profile: any) => ({
            id: profile._id,
            name: profile.userId?.fullName || 'Unknown',
            email: profile.userId?.email || 'Unknown',
            deactivatedAt: profile.deactivatedAt,
            deactivationReason: profile.deactivationReason,
            hasProfileImage: !!profile.profileImageUrl,
            hasMetrics: !!(profile.metrics && Object.keys(profile.metrics).length > 0),
            hasMeasurements: !!(profile.measurements && Object.keys(profile.measurements).length > 0),
            hasResume: !!(profile.resumeData && profile.resumeData.length > 0),
          })),
        },
      });
    } catch (err) {
      console.error('[AthleteActivationService] Error getting profiles for reactivation:', err);
      return error(err, req, res);
    }
  }

  /**
   * Get activation statistics and summary
   */
  public static async getActivationStatistics(req: Request, res: Response): Promise<Response> {
    try {
      const profilesForDeactivation = await AthleteActivationHandler.getProfilesForDeactivation();
      const profilesForReactivation = await AthleteActivationHandler.getProfilesForReactivation();

      return res.status(200).json({
        success: true,
        data: {
          pendingDeactivation: {
            count: profilesForDeactivation.length,
            description: 'Profiles older than 1 day with zero work done',
          },
          pendingReactivation: {
            count: profilesForReactivation.length,
            description: 'Inactive profiles that have been completed',
          },
          lastProcessed: null, // Could be enhanced to track last processing time
        },
      });
    } catch (err) {
      console.error('[AthleteActivationService] Error getting activation statistics:', err);
      return error(err, req, res);
    }
  }
}
