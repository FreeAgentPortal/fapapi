import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import SupportTicket from '../models/Support'; // Adjust path as needed
import SupportGroup from '../models/SupportGroups';
import { UserType } from '../../auth/model/User';
import { ErrorUtil } from '../../../middleware/ErrorUtil';
import SupportMessage from '../models/SupportMessage';

export class TicketHandler {
  // Create a new support ticket
  async createTicket(data: { user: UserType; body: any }) {
    const newTicket = await SupportTicket.create({
      ...data.body,
      requester: data.user ? data.user._id : null,
      requesterDetails: {
        email: data.user ? data.user.email : data.body.email,
        fullName: data.user ? data.user.fullName : data.body.fullName,
      },
    });

    if (!newTicket) {
      throw new ErrorUtil('Ticket not created', 400);
    }
    // next we need to find all of our support groups and assign the ticket to the group
    // that matches the category, the Category field is an array of strings, so find
    // all groups that match the category strings
    const groups = await SupportGroup.find({
      name: { $in: newTicket.category },
    });

    // if no groups are found, return a 400 error something went wrong...
    if (!groups.length) {
      throw new ErrorUtil('No Support Groups Found', 401);
    }
    //update the ticket with the groups that were found
    newTicket.groups = groups.map((group) => group._id) as any;

    // next we want to create a message for the ticket
    const message = await SupportMessage.create({
      ticket: newTicket._id,
      message: data.body.message,
      // These fields are technically optional, as the messages will be attached
      // to a ticket, which will have the requester and sender fields, but it's
      // good to have them here for reference.
      user: data.user ? data.user._id : null,
      sender: {
        fullName: data.user ? data.user.fullName : data.body.fullName,
        avatarUrl: data.user ? data.user?.profileImageUrl : null,
      },
    });

    // if the message was not created, return a 400 error
    if (!message) {
      // the ticket will still be created, but the message will not be attached
      throw new ErrorUtil('Message was not created', 401);
    }
    return await newTicket.save();
  }

  // Retrieve all tickets for a user
  async getTickets(options: { filters: Array<Object>; sort: Record<string, 1 | -1>; query: Array<Object>; page: Number; limit: Number }) {
    return await SupportTicket.aggregate([
      {
        $match: {
          $and: [
            ...options.filters, // Apply user filter here
          ],
          ...(options.query.length > 0 && { $or: options.query }), // Only include `$or` if it has conditions
        },
      },
      {
        $sort: {
          ...options.sort,
        },
      },
      {
        $facet: {
          metadata: [
            { $count: 'totalCount' }, // Count the total number of documents
            { $addFields: { page: options.page, limit: options.limit } }, // Add metadata for the page and page size
          ],
          entries: [
            { $skip: (Number(options.page) - 1) * Number(options.limit) },
            { $limit: Number(options.limit) },
            {
              $lookup: {
                from: 'supportgroups',
                localField: 'groups',
                foreignField: '_id',
                as: 'groups',
                pipeline: [
                  {
                    $project: {
                      name: 1,
                      _id: 1,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);
  }

  // Retrieve a single ticket by ID
  async getTicket(ticketId: string) {
    return await SupportTicket.findById(ticketId);
  }

  // Update a ticket (e.g., reply or status change)
  async updateTicket(ticketId: string, req: AuthenticatedRequest) {
    const item = await SupportTicket.findById(req.params.id);

    if (!item) {
      const error: any = new Error('Ticket not found');
      error.status = 404;
      throw error;
    }
    // next we need to find all of our support groups and assign the ticket to the group
    // that matches the category, the Category field is an array of strings, so find
    // all groups that match the category strings
    const groups = await SupportGroup.find({
      name: { $in: req.body.category },
    });

    // if no groups are found, return a 400 error something went wrong...
    if (!groups.length) {
      const error: any = new Error('Ticket Group not found');
      error.status = 404;
      throw error;
    }

    //update the ticket with the groups that were found
    item.groups = groups.map((group) => group._id) as any;

    const updatedItem = await SupportTicket.findByIdAndUpdate(
      item._id,
      { ...req.body },
      {
        new: true,
        runValidators: true,
      }
    );
    if (!updatedItem) {
      const error: any = new Error('Ticket Was not able to be Updated');
      error.status = 400;
      throw error;
    }
    return await updatedItem.save();
  }

  // Delete a ticket by ID
  async deleteTicket(ticketId: string) {
    const ticket = await SupportTicket.findByIdAndDelete(ticketId);
    if (!ticket) throw new Error('Ticket not found or already deleted');
    return ticket;
  }
}
