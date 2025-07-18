import { ErrorUtil } from '../../../middleware/ErrorUtil';
import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import User, { UserType } from '../../auth/model/User';
import crypto from 'crypto';

export class UserHandler extends CRUDHandler<UserType> {
  constructor() {
    super(User);
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
}
