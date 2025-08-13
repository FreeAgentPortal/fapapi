import { Request, Response } from 'express';
import { ReportSchedulerCron } from '../cron/ReportScheduler.cron';
import { SchedulerHandler } from '../handlers/Scheduler.handler';
import SearchPreferences from '../models/SearchPreferences';
import error from '../../../middleware/error';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';

export class SchedulerService {
  /**
   * Get the status of the report scheduler
   */
  public static async getSchedulerStatus(req: Request, res: Response): Promise<Response> {
    try {
      const status = ReportSchedulerCron.getStatus();

      // Get some basic stats
      const totalPreferences = await SearchPreferences.countDocuments();
      const activePreferences = await SearchPreferences.countDocuments({
        frequency: { $gt: 0 },
      });

      return res.status(200).json({
        success: true,
        data: {
          scheduler: status,
          statistics: {
            totalSearchPreferences: totalPreferences,
            activeSearchPreferences: activePreferences,
          },
        },
      });
    } catch (err) {
      console.error('[SchedulerService] Error getting scheduler status:', err);
      return error(err, req, res);
    }
  }

  /**
   * Manually trigger report generation for all due preferences
   */
  public static async triggerAllReports(req: Request, res: Response): Promise<Response> {
    try {
      console.log('[SchedulerService] Manual trigger for all due reports requested');

      // Trigger the report generation process
      await ReportSchedulerCron.triggerManualReportGeneration();

      return res.status(200).json({
        success: true,
        message: 'Report generation triggered successfully',
      });
    } catch (err) {
      console.error('[SchedulerService] Error triggering all reports:', err);
      return error(err, req, res);
    }
  }

  /**
   * Manually trigger report generation for a specific search preference
   */
  public static async triggerSpecificReport(req: Request, res: Response): Promise<Response> {
    try {
      const { preferenceId } = req.params;

      if (!preferenceId) {
        return res.status(400).json({
          success: false,
          message: 'Search preference ID is required',
        });
      }

      console.log(`[SchedulerService] Manual trigger for specific report requested: ${preferenceId}`);

      // Verify the search preference exists
      const searchPreference = await SearchPreferences.findById(preferenceId);
      if (!searchPreference) {
        return res.status(404).json({
          success: false,
          message: 'Search preference not found',
        });
      }

      // Generate the report
      const reportData = await SchedulerHandler.generateReport(searchPreference);
      console.log('[SchedulerService] Report generated successfully', reportData);

      // Update the dateLastRan
      await SearchPreferences.findByIdAndUpdate(preferenceId, { dateLastRan: new Date() }, { new: true });

      return res.status(200).json({
        success: true,
        message: 'Report generated successfully',
        data: {
          reportId: reportData.reportId,
          resultCount: reportData.results.length,
          generatedAt: reportData.generatedAt,
          _id: reportData._id,
        },
      });
    } catch (err) {
      console.error('[SchedulerService] Error triggering specific report:', err);
      return error(err, req, res);
    }
  }

  /**
   * Get all search preferences for the authenticated user
   */
  public static async getUserSearchPreferences(req: Request, res: Response): Promise<Response> {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get user's search preferences
      const preferences = await SearchPreferences.find({
        ownerId: authReq.user._id,
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: preferences,
      });
    } catch (err) {
      console.error('[SchedulerService] Error getting user search preferences:', err);
      return error(err, req, res);
    }
  }

  /**
   * Update search preference scheduling settings
   */
  public static async updateSchedulingSettings(req: Request, res: Response): Promise<Response> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { preferenceId } = req.params;
      const { frequency, frequencyType } = req.body;

      if (!authReq.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Validate input
      if (frequency !== undefined && (frequency < 0 || !Number.isInteger(frequency))) {
        return res.status(400).json({
          success: false,
          message: 'Frequency must be a non-negative integer',
        });
      }

      if (frequencyType && !['daily', 'weekly', 'monthly'].includes(frequencyType)) {
        return res.status(400).json({
          success: false,
          message: 'Frequency type must be daily, weekly, or monthly',
        });
      }

      // Find and update the search preference
      const searchPreference = await SearchPreferences.findOne({
        _id: preferenceId,
        ownerId: authReq.user._id, // Ensure user owns this preference
      });

      if (!searchPreference) {
        return res.status(404).json({
          success: false,
          message: 'Search preference not found or access denied',
        });
      }

      // Update the scheduling settings
      const updateData: any = {};
      if (frequency !== undefined) updateData.frequency = frequency;
      if (frequencyType !== undefined) updateData.frequencyType = frequencyType;

      const updatedPreference = await SearchPreferences.findByIdAndUpdate(preferenceId, updateData, { new: true, runValidators: true });

      return res.status(200).json({
        success: true,
        message: 'Scheduling settings updated successfully',
        data: updatedPreference,
      });
    } catch (err) {
      console.error('[SchedulerService] Error updating scheduling settings:', err);
      return error(err, req, res);
    }
  }
}
