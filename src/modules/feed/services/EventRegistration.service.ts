import { CRUDService } from "../../../utils/baseCRUD";
import { EventRegistrationHandler } from "../handlers/EventRegistration.handler";

export default class EventRegistrationService extends CRUDService{
  constructor() {
    super(EventRegistrationHandler);
  }
}