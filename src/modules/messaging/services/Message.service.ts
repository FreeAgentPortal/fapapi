import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/AuthenticatedRequest';
import asyncHandler from '../../../middleware/asyncHandler';
import { ConversationHandler } from '../handlers/Conversation.handler';
import error from '../../../middleware/error';
import { CRUDService } from '../../../utils/baseCRUD';
import { ConversationCrudHandler } from '../handlers/ConversationCrud.handler';
import { eventBus } from '../../../lib/eventBus';
import { MessageCRUDHandler } from '../handlers/MessageCRUD.handler';

export class MessageService extends CRUDService {
  constructor() {
    super(MessageCRUDHandler);
    this.requiresAuth = {
      create: true,
      getResource: true,
      getResources: true,
      updateResource: true,
      removeResource: true,
    };
    this.queryKeys = ['participants.team', 'participants.athlete'];
  }
  public updateResource = async (req: Request, res: Response): Promise<Response> => {
    try {
      this.ensureAuthenticated(req as AuthenticatedRequest, 'updateResource');
 
      await this.beforeUpdate(req.params.id, req.body);
      const result = await this.handler.update(req.params.id, req.body);
      await this.afterUpdate(result);
      return res.status(201).json({ success: true });
    } catch (err) {
      console.error(err);
      return error(err, req, res);
    }
  };
}
