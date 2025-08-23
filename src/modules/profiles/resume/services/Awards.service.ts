import { Request, Response } from 'express';
import { CRUDService } from '../../../../utils/baseCRUD';
import AwardsCRUDHandler from '../handlers/AwardsCRUD.handler';
import error from '../../../../middleware/error';
import asyncHandler from '../../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';

export default class AwardsService extends CRUDService {
  constructor() {
    super(AwardsCRUDHandler);
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const {
        owner: { kind: ownerKind, ref: ownerRef },
      } = req.body;
      const result = await this.handler.addAward(ownerKind, ownerRef, req.body);
      return res.status(201).json(result);
    } catch (err) {
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
      const result = await this.handler.updateAward(ownerKind, ownerRef, id, patch);
      return res.status(200).json(result);
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };

  public deleteResource = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const { id, itemId } = req.params;
    try {
      const result = await this.handler.removeAward(id, itemId);
      return res.status(200).json(result);
    } catch (err) {
      return error(err, req, res);
    }
  });
}
