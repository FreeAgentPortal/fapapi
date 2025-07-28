import mongoose from 'mongoose';
import { CRUDHandler, PaginationOptions } from '../../../../utils/baseCRUD';
import { IScout, ScoutModel } from '../model/ScoutProfile';
import { ErrorUtil } from '../../../../middleware/ErrorUtil';
import { RolesConfig } from '../../../../utils/RolesConfig';

export class ScoutProfileHandler extends CRUDHandler<IScout> {
  constructor() {
    super(ScoutModel);
  }

  protected async afterCreate(doc: IScout): Promise<void> {
    try {
      // Find the user by id and update the profileRefs
      const user = await mongoose.model('User').findById(doc.userId);
      if (!user) {
        // Delete the scout profile since user wasn't found
        await this.Schema.findByIdAndDelete(doc._id);
        throw new ErrorUtil('[Profiles - Scout] User not found', 404);
      }

      // Update the profileRefs map with new scout profile
      user.profileRefs.scout = doc._id;

      try {
        await mongoose.model('User').findByIdAndUpdate(user._id, { profileRefs: user.profileRefs }, { new: true });
      } catch (userSaveError) {
        // Delete the scout profile if saving user fails
        await this.Schema.findByIdAndDelete(doc._id);
        throw new ErrorUtil('[Profiles - Scout] Failed to update user profile references', 500);
      }

      // if permissions where already provided by the frontend in the create step, we dont want to override them
      if (doc.permissions && doc.permissions.length > 0) {
        return; // Skip permission assignment if already provided
      }
      // Assign granulated permissions based on roles
      try {
        const permissions = RolesConfig.getDefaultPermissionsForRoles(['scout']);
        doc.permissions = permissions;
        await doc.save();
      } catch (permissionError) {
        // Rollback: remove scout reference from user and delete scout profile
        user.profileRefs.scout = undefined;
        await user.save();
        await this.Schema.findByIdAndDelete(doc._id);
        throw new ErrorUtil('[Profiles - Scout] Failed to assign permissions to scout profile', 500);
      }
    } catch (error) {
      if (error instanceof ErrorUtil) {
        throw error;
      }
      // Cleanup: attempt to delete admin profile if it exists
      try {
        await this.Schema.findByIdAndDelete(doc._id);
      } catch (deleteError) {
        // Log the cleanup failure but don't override the original error
        console.error('[Profiles - Scout] Failed to cleanup scout profile during error recovery:', deleteError);
      }
      throw new ErrorUtil('Failed to create scout profile', 500);
    }
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: IScout[]; metadata: any[] }[]> {
    try {
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
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'user',
                  pipeline: [
                    {
                      $project: {
                        _id: 1,
                        email: 1,
                        fullName: 1,
                        profileImageUrl: 1,
                      },
                    },
                  ],
                },
              },
              {
                // lookup from scout reports collection all reports created by this scout
                $lookup: {
                  from: 'scoutreports',
                  localField: '_id',
                  foreignField: 'scoutId',
                  as: 'reports',
                },
              },
              {
                $unwind: {
                  path: '$user',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                // get count of permissions array
                $addFields: {
                  permissionsCount: { $size: '$permissions' },
                  reportsCount: { $size: '$reports' },
                },
              },
              {
                $project: {
                  _id: 1,
                  user: 1,
                  roles: 1,
                  permissionsCount: 1,
                  reportsCount: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],
          },
        },
      ]);
    } catch (error) {
      console.error(error);
      throw new ErrorUtil('[Profiles - Scout] Failed to fetch scout profiles', 500);
    }
  }
}
