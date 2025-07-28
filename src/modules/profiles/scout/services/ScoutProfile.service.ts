import { CRUDService } from "../../../../utils/baseCRUD";
import { ScoutProfileHandler } from "../handlers/ScoutProfile.handler";

export class ScoutProfileService extends CRUDService{
  constructor() {
    super(ScoutProfileHandler);
  }
}