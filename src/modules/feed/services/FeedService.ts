import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import error from '../../../middleware/error';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { NewsFeedHandler, PaginationOptions } from '../handlers/NewsFeedHandler';

export default class FeedService {
  constructor(private readonly handler: NewsFeedHandler = new NewsFeedHandler()) {}

  public fetchArticles = async (req: Request, res: Response): Promise<Response> => {
    try {
      const paginationOptions = {
        page: parseInt(req.query.pageNumber as string) || 1,
        per_page: parseInt(req.query.limit as string) || 10,
        orderby: req.query.sortOptions as string,
        search: req.query.keyword as string,
      } as PaginationOptions;
      const results = await this.handler.fetchArticles(paginationOptions);
      return res.status(200).json({
        success: true,
        payload: [...results.posts],
        metadata: {
          page: results.currentPage,
          pages: results.totalPages,
          totalCount: results.totalPages || 0,
          prevPage: results.currentPage - 1,
          nextPage: results.currentPage + 1,
        },
      });
    } catch (err: any) {
      console.error(err);
      return error(err, req, res);
    }
  };
}
