import { CRUDService } from '../../../../utils/baseCRUD';
import AwardsCRUDHandler from '../handlers/AwardsCRUD.handler';

export default class AwardsService extends CRUDService {
  constructor() {
    super(AwardsCRUDHandler);
  }
}
