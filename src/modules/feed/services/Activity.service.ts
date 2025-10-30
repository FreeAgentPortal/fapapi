import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { CRUDService } from '../../../utils/baseCRUD';
import { ActivityHandler } from '../handlers/Activity.handler';
import error from '../../../middleware/error';

export class ActivityService extends CRUDService {
  constructor() {
    super(ActivityHandler);
  }

  public getResources = async (req: Request, res: Response): Promise<Response> => {
    try {
      this.ensureAuthenticated(req as AuthenticatedRequest, 'getResources');
      const pageSize = Number(req.query?.pageLimit) || 10;
      const page = Number(req.query?.pageNumber) || 1;

      // Generate the keyword query
      const keywordQuery = AdvFilters.query(this.queryKeys, req.query?.keyword as string);

      // Generate the filter options for inclusion if provided
      const filterIncludeOptions = AdvFilters.filter(req.query?.includeOptions as string);

      // Construct the `$or` array conditionally
      const orConditions = [
        ...(Object.keys(keywordQuery[0]).length > 0 ? keywordQuery : []),
        ...(Array.isArray(filterIncludeOptions) && filterIncludeOptions.length > 0 && Object.keys(filterIncludeOptions[0]).length > 0 ? filterIncludeOptions : []),
      ];

      const paginationOptions = {
        filters: AdvFilters.filter(req.query?.filterOptions as string),
        sort: AdvFilters.sort((req.query?.sortOptions as string) || '-createdAt'),
        query: orConditions,
        page,
        limit: pageSize,
      };

      await this.beforeFetchAll(paginationOptions);

      // Extract userId if authenticated
      const userId = (req as AuthenticatedRequest).user?._id?.toString();

      // Call ActivityHandler's fetchAll with userId
      const [result] = await this.handler.fetchAll(paginationOptions, userId);

      await this.afterFetchAll(result);

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
      console.error(err);
      return error(err, req, res);
    }
  };
}
