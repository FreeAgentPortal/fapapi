import { Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDService } from '../../../utils/baseCRUD';
import { NCRUDHandler } from '../handler/NCRUDHandler';

export class NCRUDService extends CRUDService {
  constructor() {
    super(NCRUDHandler);
  }

  public sendAlert = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      await this.handler.alertUsers(req.body);
      return res.status(200).json({ success: true, message: 'Notifications sent successfully.' });
    } catch (err) {
      console.error('Error sending notifications:', err);
      return res.status(500).json({ success: false, message: 'Error sending notifications.', error: err instanceof Error ? err.message : String(err) });
    }
  });

  public updateAll = asyncHandler(async (req: Request & AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const results = await this.handler.updateAll(req.user._id);
      return res.status(200).json({ success: true, data: results.data, message: 'All resources updated successfully.' });
    } catch (err) {
      console.error('Error updating all resources:', err);
      return res.status(500).json({ success: false, message: 'Error updating all resources.', error: err instanceof Error ? err.message : String(err) });
    }
  });
}
