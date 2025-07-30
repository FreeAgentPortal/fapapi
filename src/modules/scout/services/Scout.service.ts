import { Request, Response } from 'express';
import { CRUDService } from '../../../utils/baseCRUD';
import { ScoutActionsHandler } from '../handlers/ScoutActions.handler';
import { ScoutCRUDHandler } from '../handlers/ScoutCRUD.handler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';

export class ScoutService extends CRUDService {
  constructor(private readonly actionsHandler: ScoutActionsHandler = new ScoutActionsHandler()) {
    super(ScoutCRUDHandler);
    this.requiresAuth = {
      create: true,
      update: true,
      delete: true,
      getResources: false, // Public access to list resources
      getResource: false, // Public access to view a single resource
      reportSubmission: true, // Requires authentication for report submission
    };
  }

  public reportSubmission = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const result = await this.actionsHandler.handleScoutReportSubmission(req.body, req.params.id as string);
      return res.status(200).json({
        success: true,
        message: 'Scout report processed successfully',
        data: result,
      });
    } catch (error) {
      console.error('[ScoutService] Error in reportSubmission:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
}
