import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { SupportHandler } from '../handlers/SupportHandler';
import asyncHandler from '../../../middleware/asyncHandler';
import { CRUDService } from '../../../utils/baseCRUD';

export default class SupportService extends CRUDService{
  constructor() {
    super(SupportHandler);
  } 

}
