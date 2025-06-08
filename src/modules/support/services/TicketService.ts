import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { TicketHandler } from '../handlers/TicketHandler';
import authenticateUser from '../../../utils/authenticateUser';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';

export default class TicketService {
  constructor(private readonly ticketHandler: TicketHandler = new TicketHandler()) {}

  public create = async (req: Request, res: Response): Promise<Response> => {
    try {
      const authUser = await authenticateUser(req.headers.authorization);
      await this.ticketHandler.createTicket({ user: authUser, body: req.body });
      return res.status(201).json({ success: true });
    } catch (err) {
      return error(err, req, res);
    }
  };
  public getResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      const [result] = await this.ticketHandler.getTicket(req.params.id);
      if (!result) {
        return res.status(404).json({ message: 'Resource Not found' });
      }
      return res.status(200).json({
        success: true,
        payload: {
          result,
        },
      });
    } catch (err) {
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
      const [result] = await this.ticketHandler.getTickets({
        filters: AdvFilters.filter(req.query.filterOptions as string),
        sort: AdvFilters.sort((req.query.sortOptions as string) || '-createdAt'),
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
      return res.status(400).json({ message: 'This Method hasnt been implemented Yet' });
    } catch (err) {
      return error(err, req, res);
    }
  };
  public removeResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      return res.status(400).json({ message: 'This Method hasnt been implemented Yet' });
    } catch (err) {
      return error(err, req, res);
    }
  };
}
