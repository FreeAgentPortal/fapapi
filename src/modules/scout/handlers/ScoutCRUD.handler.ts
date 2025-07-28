import { Model } from 'mongoose';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import ScoutReport, { IScoutReport } from '../models/ScoutReport';
import { ModelMap } from '../../../utils/ModelMap';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { RolesConfig } from '../../../utils/RolesConfig';

export class ScoutCRUDHandler extends CRUDHandler<IScoutReport> {
  private modelMap: Record<string, Model<any>>;
  constructor() {
    super(ScoutReport);
    this.modelMap = ModelMap;
  }

  async create(data: any): Promise<IScoutReport> {
    try {
      // 1. attempt to locate player profile by ID
      const athlete = await this.modelMap['athlete'].findById(data.athleteId);
      if (!athlete) {
        throw new ErrorUtil('Athlete not found', 404);
      }
      // next attempt to locate the scout profile, of the user submitting the report
      const scoutProfile = await this.modelMap['scout_profile'].findOne({ user: data.user }); // user is the req.user who is submitting the report
      if (!scoutProfile) {
        throw new ErrorUtil('Scout profile not found', 404);
      }
      // ensure the scout profile has the necessary permissions
      if (!RolesConfig.hasPermission(scoutProfile.permissions, 'scouts.create')) {
        throw new ErrorUtil('Insufficient permissions', 403);
      }
      // 2. create the scout report
      const newReport = await this.Schema.create({
        athleteId: athlete._id,
        scoutId: scoutProfile._id,
        ...data,
      });

      return newReport;
    } catch (error) {
      console.error('[ScoutCRUDHandler] Error creating scout report:', error);
      throw new ErrorUtil('Failed to create scout report', 500);
    }
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: IScoutReport[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query.length > 0 && { $or: options.query }),
        },
      },
      {
        $sort: options.sort,
      },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
              $lookup: {
                from: 'athleteprofiles',
                localField: 'athleteId',
                foreignField: '_id',
                as: 'athlete',
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      fullName: 1,
                      profileImageUrl: 1,
                      diamondRating: 1, // include diamond rating
                    },
                  },
                ],
              },
            },
            {
              $lookup: {
                from: 'scoutprofiles',
                localField: 'scoutId',
                foreignField: '_id',
                as: 'scout',
                pipeline: [
                  {
                    $lookup: {
                      from: 'users', // Nested lookup to get user data
                      localField: 'user',
                      foreignField: '_id',
                      as: 'user',
                      pipeline: [
                        {
                          $project: {
                            _id: 1,
                            fullName: 1,
                            email: 1,
                            profileImageUrl: 1,
                          },
                        },
                      ],
                    },
                  },
                  {
                    $unwind: {
                      path: '$user',
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      role: 1,
                      permissions: 1,
                      user: 1, // This will now contain the inflated user object
                    },
                  },
                ],
              },
            },
            {
              $unwind: {
                path: '$athlete',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: '$scout',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);
  }
}
