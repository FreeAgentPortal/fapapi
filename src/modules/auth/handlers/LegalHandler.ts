import mongoose from 'mongoose';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import User from '../model/User';
import { CRUDHandler } from '../../../utils/baseCRUD';
import LegalPages, { LegalType } from '../model/LegalPages';

export class LegalHandler extends CRUDHandler<LegalType> {
  constructor() {
    super(LegalPages);
  }
}
