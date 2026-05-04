import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler'; 
import { CRUDService } from '../../../utils/baseCRUD';
import { LegalHandler } from '../handlers/LegalHandler';

export default class LegalService extends CRUDService {
  constructor() {
    super(LegalHandler);
    this.requiresAuth = {
      getResource: false,
      getResources: false,
      create: true,
      updateResource: true,
      removeResource: true,
    }
    this.queryKeys = ['title']
  } 
}
