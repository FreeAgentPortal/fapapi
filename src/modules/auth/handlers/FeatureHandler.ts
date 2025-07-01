import mongoose from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import FeatureSchema, { FeatureType } from '../model/FeatureSchema';
import User from '../model/User';  
import { CRUDHandler } from '../../../utils/baseCRUD';

export class FeatureHandler extends CRUDHandler<FeatureType> {
  constructor() {
    super(FeatureSchema);
  }
  protected async beforeDelete(id: string): Promise<void> {
    const data = await this.Schema.findById(id);
    const users = await User.aggregate([
      {
        $match: {
          features: { $in: [data?._id] },
        },
      },
    ]);
    if (users.length > 0) {
      throw new ErrorUtil(`Feature is being used by users and cannot be removed`, 400);
    }
  }
}
