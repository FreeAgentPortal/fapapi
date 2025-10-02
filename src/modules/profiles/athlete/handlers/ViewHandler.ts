import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';
import { AthleteViewModel, IAthleteView } from '../models/AthleteViewModel';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { ModelMap, ModelKey } from '../../../../utils/ModelMap';

export interface ViewTrackingData {
  athleteId: string;
  viewerId: string;
  viewerProfileId: string;
  viewerType: 'team' | 'athlete' | 'admin' | 'scout' | 'resume';
  viewerProfile?: any; // The actual profile document
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}

export interface ViewStats {
  totalViews: number;
  uniqueViewers: number;
  viewsByType: {
    team: number;
    athlete: number;
    admin: number;
    scout: number;
    resume: number;
  };
  recentViews: IAthleteView[];
}

export class ViewHandler {
  /**
   * Record a view for an athlete profile
   * Handles 24-hour deduplication logic
   * Expects POST body: { viewer: string, viewerType: string }
   */
  async recordAthleteView(req: AuthenticatedRequest): Promise<{ success: boolean; isNewView: boolean; view?: IAthleteView }> {
    try {
      const athleteId = req.params.id;
      const { viewer: viewerProfileId, viewerType } = req.body; 
      const viewerId = req.user._id.toString();

      // Validate input
      if (!viewerProfileId || !viewerType) {
        throw new ErrorUtil('[ViewHandler]: viewer and viewerType are required', 400);
      }

      if (!['team', 'athlete', 'admin', 'scout', 'resume'].includes(viewerType)) {
        throw new ErrorUtil('[ViewHandler]: Invalid viewerType', 400);
      }

      // Don't track if viewer profile is viewing the same athlete profile
      if (athleteId === viewerProfileId) {
        return { success: false, isNewView: false };
      }

      // Check for existing view within last 24 hours by the same profile
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const existingView = await AthleteViewModel.findOne({
        athleteId,
        viewerProfileId,
        createdAt: { $gte: last24Hours },
      });

      if (existingView) {
        // Don't create new view if one exists within 24 hours
        console.info(`[ViewHandler] View already exists within 24 hours: Athlete ${athleteId} viewed by ${viewerType} ${viewerProfileId}`);
        return { success: true, isNewView: false, view: existingView };
      }

      // Get the viewer profile using ModelMap
      const ProfileModel = ModelMap[viewerType as ModelKey];
      if (!ProfileModel) {
        throw new ErrorUtil(`[ViewHandler]: Invalid profile model for type: ${viewerType}`, 400);
      }

      const viewerProfile = await ProfileModel.findById(viewerProfileId).lean();
      if (!viewerProfile) {
        throw new ErrorUtil('[ViewHandler]: Viewer profile not found', 404);
      }

      // Create new view record
      const viewRecord = new AthleteViewModel({
        athleteId,
        viewerId,
        viewerProfileId,
        viewerType,
        sessionId: (req as any).sessionID || (req.headers['x-session-id'] as string),
        ipAddress: req.ip || req.connection?.remoteAddress || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer || (req.headers.referrer as string),
      });

      const savedView = await viewRecord.save();
      console.info(`[ViewHandler] New view recorded: Athlete ${athleteId} viewed by ${viewerType} ${viewerProfileId}`);

      return { success: true, isNewView: true, view: savedView };
    } catch (error: any) {
      console.error('[ViewHandler] Error recording view:', error);
      throw new ErrorUtil('Failed to record athlete view', 500);
    }
  }

  /**
   * Get view statistics for an athlete
   */
  async getAthleteViewStats(params: { athleteId: string; days?: any }): Promise<ViewStats> {
    try {
      const { athleteId, days = 30 } = params;
      const daysNum = parseInt(days as string) || 30;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      // Get total views and unique viewers
      const [totalViews, uniqueViewers, viewsByType, recentViews] = await Promise.all([
        AthleteViewModel.countDocuments({
          athleteId,
          createdAt: { $gte: startDate },
        }),

        AthleteViewModel.distinct('viewerId', {
          athleteId,
          createdAt: { $gte: startDate },
        }),

        // Aggregate views by type
        AthleteViewModel.aggregate([
          {
            $match: {
              athleteId: athleteId,
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: '$viewerType',
              count: { $sum: 1 },
            },
          },
        ]),

        // Get recent views
        AthleteViewModel.find({
          athleteId,
          createdAt: { $gte: startDate },
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      // Format views by type
      const viewsByTypeFormatted = {
        team: 0,
        athlete: 0,
        admin: 0,
        scout: 0,
        resume: 0,
      };

      viewsByType.forEach((item: any) => {
        viewsByTypeFormatted[item._id as keyof typeof viewsByTypeFormatted] = item.count;
      });

      return {
        totalViews,
        uniqueViewers: uniqueViewers.length,
        viewsByType: viewsByTypeFormatted,
        recentViews: recentViews as IAthleteView[],
      };
    } catch (error: any) {
      console.error('[ViewHandler] Error getting view stats:', error);
      throw new ErrorUtil('Failed to get athlete view statistics', 500);
    }
  }
}
