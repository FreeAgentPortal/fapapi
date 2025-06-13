import mongoose, { Document } from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import User from '../model/User';
import PlanSchema, { PlanType } from '../model/PlanSchema';
import { CRUDHandler } from '../../../utils/CRUDHandler';

export class PlanHandler extends CRUDHandler<PlanType> {
  constructor() {
    super(PlanSchema);
  }
}
