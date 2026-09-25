import mongoose, { PipelineStage } from 'mongoose';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { AthleteModel, IAthlete } from '../../athlete/models/AthleteModel';
import { IScout, ScoutModel } from '../model/ScoutProfile';

const SCOUT_FEATURE_ID = new mongoose.Types.ObjectId('6a7cbdf79569cccf8b0bb855');

export interface ScoutingQueueOptions {
  page: number;
  limit: number;
}

export interface ScoutingQueueResult {
  payload: Record<string, unknown>[];
  metadata: {
    page: number;
    pages: number;
    totalCount: number;
    prevPage: number | null;
    nextPage: number | null;
  };
}

export class ScoutProfileActionsHandler {
  Schema = ScoutModel;

  /**
   * Handles adding/removing favorited athletes for a scout profile.
   * @param {string} scoutId - The ID of the scout profile.
   * @param {string} athleteId - The ID of the athlete to favorite/unfavorite.
   * @returns {Promise<IScout>} - The updated scout profile.
   */
  async toggleFavoriteAthlete(scoutId: string, athleteId: string): Promise<IScout> {
    try {
      const scoutProfile = await this.Schema.findById(scoutId);
      if (!scoutProfile) {
        throw new ErrorUtil('Scout profile not found', 404);
      }
      // Ensure favoritedAthletes is initialized as an array
      if (!Array.isArray(scoutProfile.favoritedAthletes)) {
        scoutProfile.favoritedAthletes = [];
      }
      // check the favoritedAthletes array to see if the athlete is already favorited, if it is, remove it, otherwise add it
      const index = scoutProfile.favoritedAthletes.indexOf(athleteId as any);
      if (index > -1) {
        // Athlete is already favorited, remove it
        scoutProfile.favoritedAthletes.splice(index, 1);
      } else {
        // Athlete is not favorited, add it
        scoutProfile.favoritedAthletes.push(athleteId as any);
      }
      await scoutProfile.save();
      return scoutProfile;
    } catch (error) {
      console.error('[ScoutProfileActions] Error toggling favorite athlete:', error);
      throw new ErrorUtil('Failed to toggle favorite athlete', 500);
    }
  }


  async fetchFavoritedAthletes(scoutId: string): Promise<IAthlete[]> {
    try {
      const scoutProfile = await this.Schema.findById(scoutId).populate({
        path: 'favoritedAthletes',
        select: '_id fullName profileImageUrl diamondRating'
      });
      if (!scoutProfile) {
        throw new ErrorUtil('Scout profile not found', 404);
      }
      // Ensure favoritedAthletes is initialized as an array
      if (!Array.isArray(scoutProfile.favoritedAthletes)) {
        scoutProfile.favoritedAthletes = [] as any[];
      }


      return scoutProfile.favoritedAthletes as unknown as IAthlete[];
    } catch (error) {
      console.error('[ScoutProfileActions] Error fetching favorited athletes:', error);
      throw new ErrorUtil('Failed to fetch favorited athletes', 500);
    }
  }

  /**
   * Returns active athletes without any scout report. Athletes whose active
   * plan includes the scout feature are placed ahead of free athletes.
   */
  async fetchScoutingQueue(options: ScoutingQueueOptions): Promise<ScoutingQueueResult> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          $or: [{ isActive: true }, { isActive: { $exists: false } }],
        },
      },
      {
        $lookup: {
          from: 'scoutreports',
          let: { athleteId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$athleteId', '$$athleteId'] } } },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: '_scoutReports',
        },
      },
      { $match: { '_scoutReports.0': { $exists: false } } },
      {
        $lookup: {
          from: 'users',
          let: { ownerId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$ownerId'] }, { $ne: ['$isActive', false] }],
                },
              },
            },
            { $project: { _id: 1, profileImageUrl: 1 } },
          ],
          as: '_owner',
        },
      },
      { $match: { '_owner.0': { $exists: true } } },
      {
        $lookup: {
          from: 'billings',
          let: { athleteId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$profileId', '$$athleteId'] },
                    { $in: ['$status', ['active', 'trialing']] },
                  ],
                },
              },
            },
            { $sort: { updatedAt: -1, _id: -1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: 'plans',
                localField: 'plan',
                foreignField: '_id',
                as: '_plan',
              },
            },
            { $set: { _plan: { $first: '$_plan' } } },
            {
              $project: {
                _id: 0,
                planId: '$_plan._id',
                planName: '$_plan.name',
                hasScoutFeature: {
                  $in: [SCOUT_FEATURE_ID, { $ifNull: ['$_plan.features', []] }],
                },
              },
            },
          ],
          as: '_billing',
        },
      },
      {
        $set: {
          _owner: { $first: '$_owner' },
          _billing: { $first: '$_billing' },
        },
      },
      {
        $set: {
          needsScouting: { $ifNull: ['$_billing.hasScoutFeature', false] },
        },
      },
      { $sort: { needsScouting: -1, updatedAt: -1, _id: 1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
              $project: {
                _id: 1,
                userId: 1,
                fullName: 1,
                sport: 1,
                league: 1,
                positions: 1,
                college: 1,
                highSchool: 1,
                graduationYear: 1,
                birthPlace: 1,
                measurements: 1,
                metrics: 1,
                profileImageUrl: { $ifNull: ['$profileImageUrl', '$_owner.profileImageUrl'] },
                highlightVideos: 1,
                diamondRating: 1,
                needsScouting: 1,
                scoutingPriority: {
                  $cond: ['$needsScouting', 'plan_included', 'free'],
                },
                plan: {
                  _id: '$_billing.planId',
                  name: '$_billing.planName',
                },
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ];

    const [result] = await AthleteModel.aggregate(pipeline);
    const totalCount = result?.metadata?.[0]?.totalCount ?? 0;
    const pages = Math.ceil(totalCount / options.limit);

    return {
      payload: result?.entries ?? [],
      metadata: {
        page: options.page,
        pages,
        totalCount,
        prevPage: options.page > 1 ? options.page - 1 : null,
        nextPage: options.page < pages ? options.page + 1 : null,
      },
    };
  }
}
