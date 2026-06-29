import { CRUDService } from '../../../../utils/baseCRUD';
import { AthleteAssignmentCRUDHandler } from '../handlers/AthleteAssignmentCRUD.handler';

export class AthleteAssignmentService extends CRUDService {
  constructor() {
    super(AthleteAssignmentCRUDHandler);
    this.queryKeys = [];
  }
}
