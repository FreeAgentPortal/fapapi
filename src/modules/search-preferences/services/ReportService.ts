import { CRUDService } from '../../../utils/baseCRUD'; 
import { ReportHandler } from '../handlers/Report.handler';

export class ReportService extends CRUDService {
  constructor() {
    super(ReportHandler);
    // if the routes require authentication, set this.requiresAuth
    // to true for the respective methods
    this.requiresAuth = {
      getResource: true,
      getResources: true,
      create: true,
      updateResource: true,
      removeResource: true,
    };
  }
}
