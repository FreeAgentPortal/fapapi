import { CRUDService } from '../../../utils/baseCRUD';
import { SearchPreferencesHandler } from '../handlers/Search.handler';

export class SearchPreferencesService extends CRUDService {
  constructor() {
    super(SearchPreferencesHandler);
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
