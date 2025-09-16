import { CRUDService } from '../../../utils/baseCRUD';
import BillingCRUDHandler from '../handlers/BillingCRUD.handler';

export default class BillingService extends CRUDService {
  constructor() {
    super(BillingCRUDHandler);
    this.requiresAuth = {
      getResources: true,
      getResource: true,
      create: true,
      updateResource: true,
      removeResource: true,
    };
  }
}
