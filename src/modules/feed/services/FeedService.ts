import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { Handler } from '../handlers/SubscriptionHandler';

export default class FeedService {
  constructor(private readonly crudHandler: Handler = new Handler()) {} 
}
