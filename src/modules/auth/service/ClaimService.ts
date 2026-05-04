import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { ClaimHandler } from '../handlers/claim/ClaimHandler';
import { CRUDService } from '../../../utils/baseCRUD';
import { ClaimCrudHandler } from '../handlers/claim/ClaimCrudHandler';

export default class ClaimService extends CRUDService {
  constructor(private readonly actionHandler: ClaimHandler = new ClaimHandler()) {
    super(ClaimCrudHandler);
    this.queryKeys = ['type', 'status'];
  }
  public async afterCreate(data: any): Promise<void> {
    await eventBus.publish('claim.created', { claimDetails: data });
  }
  public getClaim = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const response = await this.actionHandler.fetchClaimStatus(req.query.type as string, req.query.slug as string);
      return res.status(200).json({
        success: response.success,
        payload: response.claim,
        profile: response.profile,
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public handleClaim = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const { id: claimId } = req.params;

      if (!['approve', 'deny'].includes(req.body.action)) {
        return res.status(400).json({ message: 'Invalid action' });
      }

      await this.actionHandler.handleClaim(req.body, claimId as string);
      return res.status(200).json({
        success: true,
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
