import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { ClaimHandler } from '../handlers/ClaimHandler';
import { CRUDService } from '../../../utils/baseCRUD';

export default class ClaimService extends CRUDService {
  constructor() {
    super(ClaimHandler);
  }

  public getClaim = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const response = await this.handler.fetchClaimStatus(req.query.type, req.query.slug as string);
      return res.status(200).json({
        success: response.success,
        payload: response.claim,
        profile: response.profile,
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
}
