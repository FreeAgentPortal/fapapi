import { CRUDService } from "../../../utils/baseCRUD";
import { EventHandler } from "../handlers/Event.handler";

export class EventService extends CRUDService {
  constructor() {
    super(EventHandler);
  }
}