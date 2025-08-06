import { CRUDHandler } from '../../../utils/baseCRUD';
import { ConversationModel, IConversation } from '../models/Conversation';

export class ConversationCrudHandler extends CRUDHandler<IConversation> {
  constructor() {
    super(ConversationModel);
  }
}
