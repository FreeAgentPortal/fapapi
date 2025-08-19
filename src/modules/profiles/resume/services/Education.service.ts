import { CRUDService } from '../../../../utils/baseCRUD';
import EducationCRUDHandler from '../handlers/EducationCRUD.handler';

export default class EducationService extends CRUDService {
  constructor() {
    super(EducationCRUDHandler);
  }
}
