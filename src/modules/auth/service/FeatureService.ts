import { FeatureHandler } from '../handlers/FeatureHandler';
import { CRUDService } from '../../../utils/baseCRUD';

export default class FeatureService extends CRUDService {
  constructor() {
    super(FeatureHandler);
    this.requiresAuth = {
      create: true,
      getResource: true,
      getResources: true,
      removeResource: true,
      updateResource: true,
    };
    this.queryKeys = ['name', 'type', 'shortDescription', 'detailedDescription'];
  }
}
