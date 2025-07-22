import mongoose, { Document } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import AdminModel, { AdminType } from '../model/AdminModel';
import { RolesConfig } from '../util/RolesConfig';

export class AdminProfileHandler extends CRUDHandler<AdminType> {
  constructor() {
    super(AdminModel);
  }

  protected async beforeCreate(data: any): Promise<void> {
    // Validate roles before creation
    const rolesToAssign = data.roles || [];
    const allValidRoles = rolesToAssign.every((role: any) => RolesConfig.isValidRole(role));
    if (!allValidRoles) {
      throw new ErrorUtil('Invalid role provided', 400);
    }
  }

  protected async afterCreate(doc: AdminType): Promise<void> {
    try {
      // Find the user by id and update the profileRefs
      const user = await mongoose.model('User').findById(doc.user);
      if (!user) {
        // Delete the admin profile since user wasn't found
        await this.Schema.findByIdAndDelete(doc._id);
        throw new ErrorUtil('User not found', 404);
      }

      // Update the profileRefs map with new admin profile
      user.profileRefs.admin = doc._id;

      try {
        await user.save();
      } catch (userSaveError) {
        // Delete the admin profile if saving user fails
        await AdminModel.findByIdAndDelete(doc._id);
        throw new ErrorUtil('Failed to update user profile references', 500);
      }

      // if permissions where already provided by the frontend in the create step, we dont want to override them
      if (doc.permissions && doc.permissions.length > 0) {
        return; // Skip permission assignment if already provided
      }
      // Assign granulated permissions based on roles
      try {
        const permissions = RolesConfig.getDefaultPermissionsForRoles(doc.roles);
        doc.permissions = permissions;
        await doc.save();
      } catch (permissionError) {
        // Rollback: remove admin reference from user and delete admin profile
        user.profileRefs.admin = undefined;
        await user.save();
        await AdminModel.findByIdAndDelete(doc._id);
        throw new ErrorUtil('Failed to assign permissions to admin profile', 500);
      }
    } catch (error) {
      if (error instanceof ErrorUtil) {
        throw error;
      }
      // Cleanup: attempt to delete admin profile if it exists
      try {
        await AdminModel.findByIdAndDelete(doc._id);
      } catch (deleteError) {
        // Log the cleanup failure but don't override the original error
        console.error('Failed to cleanup admin profile during error recovery:', deleteError);
      }
      throw new ErrorUtil('Failed to create admin profile', 500);
    }
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: AdminType[]; metadata: any[] }[]> {
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
                  localField: 'user',
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
                $unwind: {
                  path: '$user',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
          },
        },
      ]);
    } catch (error) {
      throw new ErrorUtil('Failed to fetch admin profiles', 500);
    }
  }

  protected async afterDelete(doc: AdminType | null): Promise<void> {
    // now that we've removed the admin profile, we need to remove the reference from the user
    if (doc) {
      const user = await mongoose.model('User').findById(doc.user);
      if (user) {
        user.profileRefs.admin = undefined; // Remove admin profile reference
        await user.save();
      }
    }
  }
}
