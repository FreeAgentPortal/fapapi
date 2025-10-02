import { CRUDHandler, PaginationOptions } from '../../../utils/baseCRUD';
import { IMessage, MessageModel } from '../models/Message';

export class MessageCRUDHandler extends CRUDHandler<IMessage> {
  constructor() {
    super(MessageModel);
  }

  async update(id: string, data: any): Promise<any | null> {
    await this.beforeUpdate(id, data);

    const updated = await this.Schema.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    await this.afterUpdate(updated);
    return updated;
  }
}
