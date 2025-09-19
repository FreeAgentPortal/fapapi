import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { ConversationModel, IConversation } from '../models/Conversation';

export class ConversationCrudHandler extends CRUDHandler<IConversation> {
  constructor() {
    super(ConversationModel);
  }

  async fetchAll(options: PaginationOptions): Promise<{ entries: IConversation[]; metadata: any[] }[]> {
    return await this.Schema.aggregate([
      {
        $match: {
          $and: [...options.filters],
          ...(options.query.length > 0 && { $or: options.query }),
        },
      },
      {
        $sort: options.sort,
      },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }, { $addFields: { page: options.page, limit: options.limit } }],
          entries: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
            {
              $lookup: {
                from: 'teamprofiles',
                localField: 'participants.team',
                foreignField: '_id',
                as: 'participants.team',
              },
            },
            {
              $unwind: {
                path: '$participants.team',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ]);
  }

  async fetch(id: string): Promise<any | null> {
    return await this.Schema.findById(id).populate('participants.team').populate('participants.athlete').populate('messages').lean();
  }

}
