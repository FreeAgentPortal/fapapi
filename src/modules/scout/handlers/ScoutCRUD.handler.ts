import { CRUDHandler } from '../../../utils/baseCRUD';
import ScoutReport, { IScoutReport } from '../models/ScoutReport';

export class ScoutCRUDHandler extends CRUDHandler<IScoutReport> {
  constructor() {
    super(ScoutReport);
  }
}
