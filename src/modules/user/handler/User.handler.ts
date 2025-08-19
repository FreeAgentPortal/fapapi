import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { ModelMap } from '../../../utils/ModelMap';
import User, { UserType } from '../../auth/model/User';
import crypto from 'crypto';

export class UserHandler extends CRUDHandler<UserType> {
  modelMap: Record<string, any>;
  constructor() {
    super(User);
    this.modelMap = ModelMap;
  }

  async generateSecurePassword(): Promise<string> {
    const password = await crypto.randomBytes(10).toString('hex');
    return password;
  }

  /**
   * Override the base update method to ensure pre-save hooks are triggered
   * This is especially important for password hashing
   */
  async update(id: string, data: any): Promise<UserType | null> {
    await this.beforeUpdate(id, data);

    // Find the document first
    const user = await this.Schema.findById(id);
    if (!user) {
      throw new ErrorUtil('User not found', 404);
    }

    // Update the fields
    Object.assign(user, data);

    // Save the document (this triggers pre-save hooks)
    const updated = await user.save({ validateBeforeSave: true });

    await this.afterUpdate(updated);
    return updated;
  }

  protected async afterDelete(doc: UserType | null): Promise<void> {
    // now that we've removed the resource, we need to clean up any related data
    // start by going through the profileRefs, for each profile remove the userId, or linkedUsers (if team)
    if (!doc) return;

    for (const [role, profileId] of Object.entries(doc.profileRefs)) {
      console.log(`Cleaning up profile for role: ${role}, profileId: ${profileId}`);
      const profile = await this.modelMap[role].findById(profileId);
      if (!profile) continue;
      
      // Remove the userId from the profile
      profile.userId = null;

      if (role === 'team') {
        profile.linkedUsers = profile.linkedUsers.filter((id: string) => id !== doc.id);
      }
      await profile.save();
    }
  }
}
