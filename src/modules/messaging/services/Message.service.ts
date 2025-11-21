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
   
    this.queryKeys = ['participants.team', 'participants.athlete'];
  }
}
