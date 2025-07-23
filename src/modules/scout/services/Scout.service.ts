import { CRUDService } from "../../../utils/baseCRUD";
import { ScoutCRUDHandler } from "../handlers/ScoutCRUD.handler";
import { IScoutReport } from "../models/ScoutReport";

export class ScoutService extends CRUDService {
  constructor() {
    super(ScoutCRUDHandler);
  }

}