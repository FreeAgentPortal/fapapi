import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { FeatureHandler } from '../handlers/FeatureHandler';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { CRUDService } from '../../../utils/baseCRUD';

export default class FeatureService extends CRUDService {
  constructor() {
    super(FeatureHandler);
    this.requiresAuth = {
      create: true,
      getResource: true,
      getResources: true,
      removeResource: true,
      updateResource: true,
    };
    this.queryKeys = ['name', 'type', 'shortDescription', 'detailedDescription'];
  }
}
