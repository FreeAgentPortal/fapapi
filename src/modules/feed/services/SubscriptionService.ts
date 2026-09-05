import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { Handler } from '../handlers/SubscriptionHandler';
import { CRUDService } from '../../../utils/baseCRUD';
import logger from '../../../utils/logger';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

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
      const subscriberRole = req.body?.subscriber?.role;
      const supportedRoles = ['athlete', 'team', 'scout', 'agent'];
      if (!supportedRoles.includes(subscriberRole)) {
        throw new ErrorUtil('A valid subscriber role is required.', 400);
      }

      const subscriberProfileId = req.user.profileRefs[subscriberRole];
      if (!subscriberProfileId) {
        throw new ErrorUtil(`Authenticated user does not have a linked ${subscriberRole} profile.`, 403);
      }

      const result = await this.handler.toggle(
        { role: subscriberRole, profileId: subscriberProfileId as any },
        req.body.target
      );
      return res.status(201).json({ success: true, payload: result });
    } catch (err) {
      logger.error({ err, subscriber: req.body.subscriber, target: req.body.target }, '[SubscriptionService] Failed to toggle subscription.');
      return error(err, req, res);
    }
  });
}
