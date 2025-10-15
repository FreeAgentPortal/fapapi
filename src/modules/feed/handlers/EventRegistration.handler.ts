import { CRUDHandler } from "../../../utils/baseCRUD";
import { EventRegistrationDocument, EventRegistrationModel } from "../model/EventRegistration.model";

export class EventRegistrationHandler extends CRUDHandler<EventRegistrationDocument>{
  constructor() {
    super(EventRegistrationModel);
  }
}