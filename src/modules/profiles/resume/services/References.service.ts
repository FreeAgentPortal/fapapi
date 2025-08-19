import { CRUDService } from '../../../../utils/baseCRUD';
import ReferencesCRUDHandler from '../handlers/ReferencesCRUD.handler';

export default class ReferencesService extends CRUDService {
  constructor() {
    super(ReferencesCRUDHandler);
  }
}
