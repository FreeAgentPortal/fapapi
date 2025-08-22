import { Request, Response } from 'express';
import { CRUDService } from '../../../../utils/baseCRUD';
import ExperienceCRUDHandler from '../handlers/ExperienceCRUD.handler';
import error from '../../../../middleware/error';
import asyncHandler from '../../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';

export default class ExperienceService extends CRUDService {
  constructor() {
    super(ExperienceCRUDHandler);
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const {
        owner: { kind: ownerKind, ref: ownerRef },
      } = req.body;

      console.log(req.body);
      const result = await this.handler.addExperience(ownerKind, ownerRef, req.body);
      return res.status(201).json(result);
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });

  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      const {
        owner: { kind: ownerKind, ref: ownerRef },
      } = req.body;
      const patch = req.body;
      const result = await this.handler.updateExperience(ownerKind, ownerRef, id, patch);
      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  };

  public deleteResource = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const { id, itemId } = req.params;
    try {
      const result = await this.handler.removeExperience(id, itemId);
      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
