import { CRUDService } from '../../../../utils/baseCRUD';
import QACRUDHandler from '../handlers/QACRUD.handler';

export default class QAService extends CRUDService {
  constructor() {
    super(QACRUDHandler);
  }
}
