import { Request, Response } from 'express';
import { CRUDService } from '../../../../utils/baseCRUD';
import AwardsCRUDHandler from '../handlers/AwardsCRUD.handler';
import error from '../../../../middleware/error';

export default class AwardsService extends CRUDService {
  constructor() {
    super(AwardsCRUDHandler);
  }

  public updateResource: (req: Request, res: Response) => Promise<Response> = async (req, res) => {
    const { id } = req.params;
    const { ownerKind, ownerRef } = req.body;
    const patch = req.body;

    try {
      const result = await this.handler.updateAward(ownerKind, ownerRef, id, patch);
      return res.status(200).json(result);
    } catch (err) {
      return error(err, req, res);
    }
  };

  public deleteResource: (req: Request, res: Response) => Promise<Response> = async (req, res) => {
    const { id } = req.params;
    const { ownerKind, ownerRef } = req.body;

    try {
      const result = await this.handler.deleteAward(ownerKind, ownerRef, id);
      return res.status(200).json(result);
    } catch (err) {
      return error(err, req, res);
    }
  };
}
