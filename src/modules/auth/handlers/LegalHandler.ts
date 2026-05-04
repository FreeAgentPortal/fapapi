import mongoose from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import User from '../model/User';
import { CRUDHandler } from '../../../utils/baseCRUD';
import LegalPages, { LegalType } from '../model/LegalPages';

export class LegalHandler extends CRUDHandler<LegalType> {
  constructor() {
    super(LegalPages);
  }

  async fetch(id: string): Promise<any | null> {
    // if id is a valid ObjectId, search by id or slug
    if (mongoose.Types.ObjectId.isValid(id)) {
      return await this.Schema.findOne({
        $or: [{ _id: new mongoose.Types.ObjectId(id) }],
      }).lean();
    }
    return await this.Schema.findOne({
      $or: [{ slug: id }, { type: id }],
    }).lean();
  }
}
