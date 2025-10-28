import { CRUDService } from "../../../utils/baseCRUD";
import { ActivityHandler } from "../handlers/Activity.handler";

export class ActivityService extends CRUDService {
  constructor() {
    super(ActivityHandler);
  }
}