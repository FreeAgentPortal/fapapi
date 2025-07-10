import { CRUDHandler } from '../../../utils/baseCRUD';
import SearchReport, { ISearchReport } from '../models/SearchReport';

export class ReportHandler extends CRUDHandler<ISearchReport> {
  constructor() {
    super(SearchReport);
  }
}
