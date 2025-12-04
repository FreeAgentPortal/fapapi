import { CRUDService } from '../../../utils/baseCRUD';
import { SigningHandler } from '../handlers/Signing.handler';

export default class SigningService extends CRUDService {
  constructor() {
    super(SigningHandler);
    this.requiresAuth = {
      create: true,
      getResource: true,
      removeResource: true,
      updateResource: true,
    };
    this.queryKeys = [];
  }
}
