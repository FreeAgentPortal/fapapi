import { Request } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import SupportGroup, { SupportGroupType } from '../models/SupportGroups';
import { CRUDHandler } from '../../../utils/baseCRUD';

export class SupportGroupHandler extends CRUDHandler<SupportGroupType> {
  constructor() {
    super(SupportGroup);
  }
}
