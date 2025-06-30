import { CRUDService } from '../../../utils/baseCRUD';
import { NCRUDHandler } from '../handler/NCRUDHandler';

export class NCRUDService extends CRUDService {
  constructor() {
    super(NCRUDHandler);
  }
}
