import { Request, Response } from 'express';
import { eventBus } from '../../../lib/eventBus';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import error from '../../../middleware/error';
import { TicketHandler } from '../handlers/TicketHandler';
import authenticateUser from '../../../utils/authenticateUser';
import { AdvFilters } from '../../../utils/advFilter/AdvFilters';
import { CRUDService } from '../../../utils/baseCRUD';
import socket from '../../../utils/socket';

export default class TicketService extends CRUDService {
  constructor() {
    super(TicketHandler);
  }

  protected async beforeCreate(data: any): Promise<void> {
    // try to authenticate the user
    const user = await authenticateUser(data.user);
    if (user) {
      data.user = user; // Attach the user to the data
    }
  }

  public getMessages = async (req: Request, res: Response): Promise<Response> => {
    try {
      // mimics the fetchAll method in CRUDService
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
      const [result] = await this.handler.getMessages({
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
          hasMore: result.metadata[0]?.totalCount > page * pageSize,
        },
      });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  };

  public createMessage = async (req: Request, res: Response): Promise<Response> => {
    try {
      const ticketId = req.params.id;
      const messageData = req.body;
      //try to authenticate the user in-case they are logged in
      const user = await authenticateUser(req.headers.authorization);
      if (user) {
        req.body.user = user; // Attach the user to the request body
      }
      const results = await this.handler.createMessage(ticketId, messageData);

      const io = socket.getIO();
      // emit a socket event to the room (ticket id) that a new message has been sent
      io.to(`support-${results.ticket._id.toString()}`).emit('newMessage', {
        message: results.message,
        ticket: results.ticket,
      });

      // emit an event to the event bus for further processing
      eventBus.publish('support.ticket.updated', {
        user: results.user,
        message: results.message,
        ticket: results.ticket,
      });

      return res.status(201).json({ success: true });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  };
}
