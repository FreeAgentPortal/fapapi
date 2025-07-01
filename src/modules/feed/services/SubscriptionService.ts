import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { Handler } from '../handlers/SubscriptionHandler';

export default class SubscriptionService {
  constructor(private readonly crudHandler: Handler = new Handler()) {}

  public create = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      await this.crudHandler.create({ ...req.body, user: req.user._id });
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
  public getResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.crudHandler.fetch(req.params.id);
      if (!result) {
        return res.status(404).json({ message: 'Resource Not found' });
      }
      return res.status(200).json({
        success: true,
        payload: result,
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public getResources = async (req: Request, res: Response): Promise<Response> => {
    try {
      const pageSize = Number(req.query?.limit) || 10;
      const page = Number(req.query?.pageNumber) || 1;
      // Generate the keyword query
      const keywordQuery = AdvFilters.query(['subject', 'description'], req.query?.keyword as string);

      // Generate the filter options for inclusion if provided
      const filterIncludeOptions = AdvFilters.filter(req.query?.includeOptions as string);

      // Construct the `$or` array conditionally
      const orConditions = [
        ...(Object.keys(keywordQuery[0]).length > 0 ? keywordQuery : []),
        ...(Array.isArray(filterIncludeOptions) && filterIncludeOptions.length > 0 && Object.keys(filterIncludeOptions[0]).length > 0 ? filterIncludeOptions : []), // Only include if there are filters
      ];
      const [result] = await this.crudHandler.fetchAll({
        filters: AdvFilters.filter(req.query?.filterOptions as string),
        sort: AdvFilters.sort((req.query?.sortOptions as string) || '-createdAt'),
        query: orConditions,
        page,
        limit: pageSize,
      });
      return res.status(200).json({
        success: true,
        payload: [...result.entries],
        metadata: {
          page,
          pages: Math.ceil(result.metadata[0]?.totalCount / pageSize) || 0,
          totalCount: result.metadata[0]?.totalCount || 0,
          prevPage: page - 1,
          nextPage: page + 1,
        },
      });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      await this.crudHandler.update(req.params.id, req.body);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public removeResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      await this.crudHandler.delete(req.params.id);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  };
  public subscribe = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      console.log(req.body);
      await this.crudHandler.toggle(req.body.subscriber, req.body.target);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.log(err);
      return error(err, req, res);
    }
  });
}
