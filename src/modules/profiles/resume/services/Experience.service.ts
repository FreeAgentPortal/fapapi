import { CRUDService } from '../../../../utils/baseCRUD';
import ExperienceCRUDHandler from '../handlers/ExperienceCRUD.handler';

export default class ExperienceService extends CRUDService {
  constructor() {
    super(ExperienceCRUDHandler);
  }
}
