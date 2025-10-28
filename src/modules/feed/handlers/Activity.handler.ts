import { CRUDHandler } from "../../../utils/baseCRUD";
import { ActivityModel, IActivity } from "../model/Activity.model";

export class ActivityHandler extends CRUDHandler<IActivity> {
  constructor() {
    super(ActivityModel);
  }
}