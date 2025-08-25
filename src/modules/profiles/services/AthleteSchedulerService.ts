import { Request, Response } from 'express';
import { AthleteSchedulerCron } from '../cron/AthleteScheduler.cron';
import { AthleteProfileCompletionHandler } from '../handlers/AthleteProfileCompletionHandler';
import { AthleteProfileAnalysisHandler } from '../handlers/AthleteProfileAnalysisHandler';
import { AthleteModel } from '../athlete/models/AthleteModel';
import error from '../../../middleware/error';

export class AthleteSchedulerService {
  /**
   * Get the status of the athlete scheduler
   */
  public static async getSchedulerStatus(req: Request, res: Response): Promise<Response> {
    try {
      const status = AthleteSchedulerCron.getStatus();
      const statistics = await AthleteProfileAnalysisHandler.getCompletionStatistics();

      return res.status(200).json({
        success: true,
        data: {
          scheduler: status,
          statistics,
        },
      });
    } catch (err) {
      console.error('[AthleteSchedulerService] Error getting scheduler status:', err);
      return error(err, req, res);
    }
  }

  /**
   * Manually trigger completion alerts for all due athletes
   */
  public static async triggerAllCompletionAlerts(req: Request, res: Response): Promise<Response> {
    try {
      console.log('[AthleteSchedulerService] Manual trigger for all completion alerts requested');

      // Trigger the completion alert process
      await AthleteSchedulerCron.triggerManualCompletionAlerts();

      return res.status(200).json({
        success: true,
        message: 'Completion alerts triggered successfully',
      });
    } catch (err) {
      console.error('[AthleteSchedulerService] Error triggering all completion alerts:', err);
      return error(err, req, res);
    }
  }

  /**
   * Manually trigger completion alert for a specific athlete
   */
  public static async triggerSpecificCompletionAlert(req: Request, res: Response): Promise<Response> {
    try {
      const { athleteId } = req.params;

      if (!athleteId) {
        return res.status(400).json({
          success: false,
          message: 'Athlete ID is required',
        });
      }

      console.log(`[AthleteSchedulerService] Manual trigger for specific completion alert requested: ${athleteId}`);

      // Verify the athlete exists
      const athlete = await AthleteModel.findById(athleteId).populate('userId', 'email firstName lastName fullName');
      if (!athlete) {
        return res.status(404).json({
          success: false,
          message: 'Athlete not found',
        });
      }

      // Send the completion alert
      await AthleteProfileCompletionHandler.sendCompletionAlert(athlete);

      return res.status(200).json({
        success: true,
        message: 'Completion alert sent successfully',
        data: {
          athleteId: athlete._id,
          athleteName: athlete.fullName,
        },
      });
    } catch (err) {
      console.error('[AthleteSchedulerService] Error triggering specific completion alert:', err);
      return error(err, req, res);
    }
  }

  /**
   * Get detailed completion report for a specific athlete
   */
  public static async getAthleteCompletionReport(req: Request, res: Response): Promise<Response> {
    try {
      const { athleteId } = req.params;

      if (!athleteId) {
        return res.status(400).json({
          success: false,
          message: 'Athlete ID is required',
        });
      }

      // Find the athlete
      const athlete = await AthleteModel.findById(athleteId).populate('userId', 'email firstName lastName fullName');
      if (!athlete) {
        return res.status(404).json({
          success: false,
          message: 'Athlete not found',
        });
      }

      // Get detailed completion report
      const report = await AthleteProfileCompletionHandler.getDetailedCompletionReport(athlete);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (err) {
      console.error('[AthleteSchedulerService] Error getting completion report:', err);
      return error(err, req, res);
    }
  }

  /**
   * Get list of incomplete athlete profiles
   */
  public static async getIncompleteProfiles(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // Get incomplete profiles with pagination
      const result = await AthleteProfileAnalysisHandler.getIncompleteProfilesWithPagination(pageNum, limitNum);

      // Get completion status for each athlete
      const profilesWithStatus = await Promise.all(
        result.profiles.map(async (athlete) => {
          const completionStatus = await AthleteProfileCompletionHandler.checkProfileCompletion(athlete);
          return {
            ...athlete,
            completion: completionStatus,
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: {
          profiles: profilesWithStatus,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.total,
            pages: result.pages,
          },
        },
      });
    } catch (err) {
      console.error('[AthleteSchedulerService] Error getting incomplete profiles:', err);
      return error(err, req, res);
    }
  }

  /**
   * Get completion statistics dashboard data
   */
  public static async getCompletionStatistics(req: Request, res: Response): Promise<Response> {
    try {
      const statistics = await AthleteProfileAnalysisHandler.getCompletionStatistics();

      // Get some additional insights
      const recentlyCreated = await AthleteModel.countDocuments({
        isActive: true,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      const recentlyUpdated = await AthleteModel.countDocuments({
        isActive: true,
        updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      return res.status(200).json({
        success: true,
        data: {
          ...statistics,
          insights: {
            recentlyCreated,
            recentlyUpdated,
          },
        },
      });
    } catch (err) {
      console.error('[AthleteSchedulerService] Error getting completion statistics:', err);
      return error(err, req, res);
    }
  }
}
