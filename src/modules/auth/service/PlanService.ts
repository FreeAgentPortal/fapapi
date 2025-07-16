import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { PlanHandler } from '../handlers/PlanHandler';
import { CRUDService } from '../../../utils/baseCRUD';

export default class PlanService extends CRUDService {
  constructor() {
    super(PlanHandler);
    this.requiresAuth = {
      create: true,
      getResource: true, 
      removeResource: true,
      updateResource: true,
    };
    this.queryKeys = ['name', 'description', 'price'];
  }
}
