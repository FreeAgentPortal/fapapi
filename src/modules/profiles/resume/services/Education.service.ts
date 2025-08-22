import { Request, Response } from 'express';
import { CRUDService } from '../../../../utils/baseCRUD';
import EducationCRUDHandler from '../handlers/EducationCRUD.handler';
import error from '../../../../middleware/error';
import asyncHandler from '../../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../../types/AuthenticatedRequest';

export default class EducationService extends CRUDService {
  constructor() {
    super(EducationCRUDHandler);
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const {
        owner: { kind: ownerKind, ref: ownerRef },
      } = req.body;
      const result = await this.handler.addEducation(ownerKind, ownerRef, req.body);
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
      const result = await this.handler.updateEducation(ownerKind, ownerRef, id, patch);
      return res.status(200).json(result);
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };

  public deleteResource = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const { id, itemId } = req.params;
    try {
      const result = await this.handler.removeEducation(id, itemId);
      return res.status(200).json(result);
    } catch (err) {
      return error(err, req, res);
    }
  });
}
