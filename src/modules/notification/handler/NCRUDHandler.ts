import { CRUDHandler } from '../../../utils/baseCRUD';
import Notification, { NotificationType } from '../model/Notification';

export class NCRUDHandler extends CRUDHandler<NotificationType> {
  constructor() {
    super(Notification);
  }
}
