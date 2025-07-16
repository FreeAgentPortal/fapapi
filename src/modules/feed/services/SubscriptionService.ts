import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { Handler } from '../handlers/SubscriptionHandler';
import { CRUDService } from '../../../utils/baseCRUD';

export default class SubscriptionService extends CRUDService {
  constructor() {
    super(Handler);
    this.requiresAuth = {
      create: true,
      getResource: true,
      getResources: true,
      removeResource: true,
      updateResource: true,
    };
    this.queryKeys = ['subscriber', 'target'];
  }

  public subscribe = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      console.log(req.body);
      await this.handler.toggle(req.body.subscriber, req.body.target);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
}
