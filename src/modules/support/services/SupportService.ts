import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { SupportHandler } from '../handlers/SupportHandler';
import asyncHandler from '../../../middleware/asyncHandler';

export default class SupportService {
  constructor(private readonly supportHandler: SupportHandler = new SupportHandler()) {}

  public getResources = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    try {
      return res.status(400).json({ message: 'This Method hasnt been implemented Yet' });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
  public createResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      await this.supportHandler.createSupportGroup(req.body);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
}
