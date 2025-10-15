import { CRUDHandler } from "../../../utils/baseCRUD";
import { EventDocument, EventModel } from "../model/Event.model";

export class EventHandler extends CRUDHandler<EventDocument>{
  constructor() {
    super(EventModel);
  } 
}  