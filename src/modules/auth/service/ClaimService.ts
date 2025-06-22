import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { CRUDService } from '../../../utils/BaseCRUD'; 
import { ClaimHandler } from '../handlers/ClaimHandler';

export default class ClaimService extends CRUDService {
  constructor() {
    super(ClaimHandler);
  }

  public getClaim = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { profile } = req.params;

      return res.status(200).json({
        success: true,
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
}
