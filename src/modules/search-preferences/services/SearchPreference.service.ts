import { Response } from 'express';
import asyncHandler from '../../../middleware/asyncHandler';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { CRUDService } from '../../../utils/baseCRUD';
import { SearchPreferencesHandler } from '../handlers/Search.handler';
import error from '../../../middleware/error';

export class SearchPreferencesService extends CRUDService {
  constructor() {
    super(SearchPreferencesHandler);
    // if the routes require authentication, set this.requiresAuth
    // to true for the respective methods
    this.requiresAuth = {
      getResource: true,
      getResources: true,
      create: true,
      updateResource: true,
      removeResource: true,
    };
    this.queryKeys = ['name', 'description', 'tags'];
  }

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const data = { ...req.body, user: req.user?._id };
      await this.beforeCreate(data);
      const result = await this.handler.create(data);
      await this.afterCreate(result);
      return res.status(201).json({ success: true, payload: { _id: result._id } });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  });
}
